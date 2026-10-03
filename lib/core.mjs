import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function assert(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
export function string(value, name, max = 200, min = 1) {
  assert(typeof value === 'string' && value.trim().length >= min && value.length <= max, `${name} must be ${min}–${max} characters.`);
  return value.trim();
}
export function uuid(value) {
  assert(typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value), 'Invalid record ID.');
  return value;
}
export function origin(value, kind) {
  let url; try { url = new URL(value); } catch { throw new AppError(`Invalid ${kind} URL.`); }
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && (url.port === '' || url.port === '443'), 'Use an HTTPS URL without credentials, a port, or query parameters.');
  assert(url.pathname === '/' || url.pathname === '', 'Enter the site origin, without a path.');
  const host = url.hostname.toLowerCase();
  const allowed = kind === 'Salesforce' ? host.endsWith('.my.salesforce.com') : kind === 'Jira' ? host.endsWith('.atlassian.net') : kind === 'Azure' ? host.endsWith('.openai.azure.com') : false;
  assert(allowed, `Unsupported ${kind} host. Use a ${kind === 'Salesforce' ? 'Salesforce My Domain' : kind === 'Jira' ? 'Jira Cloud' : 'Azure OpenAI'} URL.`);
  return url.origin;
}
export function repository(value) {
  let url; try { url = new URL(value); } catch { throw new AppError('Invalid GitHub repository URL.'); }
  const match = url.pathname.replace(/\.git$/, '').match(/^\/([A-Za-z\d_-]+)\/([A-Za-z\d_.-]+)\/?$/);
  assert(url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && match && !['.', '..'].includes(match[2]), 'Enter https://github.com/owner/repository.');
  return { url: `https://github.com/${match[1]}/${match[2]}`, owner: match[1], repo: match[2] };
}
export function key() {
  const bytes = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64');
  assert(bytes.length === 32, 'Server encryption is not configured.', 503);
  return bytes;
}
export function seal(value, context) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(context));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url');
}
export function unseal(value, context) {
  try {
    const bytes = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(context));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
  } catch { throw new AppError('Credential could not be decrypted. Reconnect the account.', 401); }
}
export function hash(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
export function jiraDefaults(value = {}) {
  let fields=value;
  if(typeof fields==='string') { try { fields=JSON.parse(fields || '{}'); } catch { throw new AppError('Jira field defaults must be a JSON object.'); } }
  assert(fields && typeof fields==='object' && !Array.isArray(fields),'Jira field defaults must be a JSON object.');
  assert(Buffer.byteLength(JSON.stringify(fields))<=16000 && Object.keys(fields).length<=30,'Jira field defaults are too large.');
  for(const [name,value] of Object.entries(fields)) {
    assert(/^(customfield_\d+|priority|components|fixVersions|versions|assignee|reporter|duedate|environment)$/.test(name),`Unsupported Jira default: ${name}. Project, issue type, summary, description, and tracking labels are managed by the application.`);
    assert(value!==null && value!=='' && (!Array.isArray(value)||value.length>0),`Jira default ${name} cannot be empty.`);
  }
  return fields;
}
export function cleanConfig(type, input) {
  const c = input || {};
  if (type === 'jira') {
    const projectKey = string(c.projectKey, 'Project key', 30).toUpperCase();
    assert(/^[A-Z][A-Z\d_]*$/.test(projectKey), 'Invalid Jira project key.');
    return { url: origin(c.url, 'Jira'), projectKey, email: string(c.email, 'Jira email', 200), issueTypeId: string(c.issueTypeId, 'Issue type ID', 30), fieldDefaults:jiraDefaults(c.fieldDefaults), token: string(c.token, 'Jira API token', 4000) };
  }
  if (type === 'github') {
    const branch = string(c.branch, 'Base branch', 100);
    assert(/^[A-Za-z\d/_-]+$/.test(branch) && !branch.includes('..'), 'Unsupported branch name.');
    const sourcePath = string(c.sourcePath || 'force-app/main/default', 'Source directory', 150);
    assert(/^[A-Za-z\d_/-]+$/.test(sourcePath) && !sourcePath.startsWith('/') && !sourcePath.split('/').includes('..'), 'Invalid source directory.');
    return { ...repository(c.url), branch, sourcePath, token: string(c.token, 'GitHub token', 4000) };
  }
  if (type === 'salesforce') return { url: origin(c.url, 'Salesforce'), clientId: string(c.clientId, 'Client ID', 1000), clientSecret: string(c.clientSecret, 'Client secret', 2000) };
  if (type === 'llm') {
    assert(['openai', 'azure'].includes(c.provider), 'Choose OpenAI or Azure OpenAI.');
    const model = string(c.model, 'Model or deployment name', 150);
    assert(/^[A-Za-z\d._:-]+$/.test(model), 'Invalid model name.');
    return { provider: c.provider, model, endpoint: c.provider === 'azure' ? origin(c.endpoint, 'Azure') : 'https://api.openai.com', apiVersion: c.provider === 'azure' ? string(c.apiVersion || '2024-10-21', 'Azure API version', 40) : '', token: string(c.token, 'Model API key', 4000) };
  }
  if (type === 'copado') {
    assert(['unknown', 'metadata', 'source', 'essentials'].includes(c.pipelineType), 'Invalid Copado pipeline type.');
    return { pipelineType: c.pipelineType, pipelineName: string(c.pipelineName, 'Pipeline name', 200), devEnvironment: string(c.devEnvironment, 'Dev environment', 200), uatEnvironment: string(c.uatEnvironment, 'UAT environment', 200), releaseOwner: string(c.releaseOwner, 'Release owner', 200), mode: 'manual-handoff' };
  }
  throw new AppError('Unsupported connection.');
}
export function publicConfig(type, c) {
  const { token, clientSecret, accessToken, refreshToken, ...safe } = c;
  return safe;
}
export function xml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }
export function xmlValue(source, name) {
  return source.match(new RegExp(`<(?:[\\w]+:)?${name}>([\\s\\S]*?)<\\/(?:[\\w]+:)?${name}>`))?.[1]?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') || '';
}
export function planSchema(raw) {
  assert(raw && typeof raw === 'object', 'The model returned an invalid plan.');
  const requirements = (raw.requirements || []).map((r, i) => ({ id: `REQ-${i + 1}`, title: string(r.title, 'Requirement title', 200), source: string(r.source, 'BRD source excerpt', 2000), acceptance: (r.acceptance || []).map(a => string(a, 'Acceptance criterion', 1000)) }));
  assert(requirements.length > 0 && requirements.length <= 50 && requirements.every(r => r.acceptance.length > 0 && r.acceptance.length <= 12), 'Plan must contain 1–50 requirements with acceptance criteria.');
  const questions = (raw.questions || []).map((q, i) => ({id:`Q-${i + 1}`, question:string(q.question, 'Question', 1000), reason:string(q.reason, 'Question reason', 1000), blocking:q.blocking !== false}));
  assert(questions.length <= 25, 'Too many clarification questions.');
  const stories = (raw.stories || []).map((s, i) => ({id:`STORY-${i + 1}`, title:string(s.title, 'Story title', 200), description:string(s.description, 'Story description', 5000), requirements:(s.requirements || []).map(r => string(r, 'Requirement ID', 30)), acceptance:(s.acceptance || []).map(a => string(a, 'Story acceptance', 1000))}));
  assert(stories.length > 0 && stories.length <= 30 && stories.every(s => s.acceptance.length > 0 && s.requirements.length > 0 && s.requirements.every(id => requirements.some(r => r.id === id))), 'Stories must map to known requirements and acceptance criteria.');
  assert(requirements.every(r => stories.some(s => s.requirements.includes(r.id))), 'Every requirement must be covered by a story.');
  assert(Array.isArray(raw.testPlan) && raw.testPlan.length>0 && raw.testPlan.length<=50,'A plan requires 1–50 acceptance test scenarios.');
  return {summary:string(raw.summary, 'Summary', 5000), solution:string(raw.solution, 'Solution', 12000), requirements, questions, stories, risks:(raw.risks || []).map(r => string(r, 'Risk', 1000)), testPlan:(raw.testPlan || []).map(r => string(r, 'Test scenario', 2000))};
}
const pathTypes = [
  [/^classes\/([A-Za-z][A-Za-z\d_]*)\.cls(?:-meta\.xml)?$/, 'ApexClass'],
  [/^objects\/([A-Za-z][A-Za-z\d_]*__c)\.object$/, 'CustomObject'],
  [/^flows\/([A-Za-z][A-Za-z\d_]*)\.flow$/, 'Flow'],
  [/^permissionsets\/([A-Za-z][A-Za-z\d_]*)\.permissionset$/, 'PermissionSet'],
  [/^lwc\/([a-z][A-Za-z\d_]*)\/[A-Za-z\d_.-]+\.(?:js|html|css|js-meta\.xml)$/, 'LightningComponentBundle']
];
export function artifactsSchema(raw, apiVersion = '65.0') {
  assert(Array.isArray(raw?.files) && raw.files.length > 0 && raw.files.length <= 100, 'Expected 1–100 generated metadata files.');
  const paths = new Set(), types = new Map(); let total = 0;
  const files = raw.files.map(f => {
    const path = string(f.path, 'File path', 200);
    assert(!path.split('/').includes('..') && !paths.has(path), 'Unsafe or duplicate metadata path.');
    const type = pathTypes.find(([pattern]) => pattern.test(path));
    assert(type, `Unsupported metadata path: ${path}.`);
    const member = path.match(type[0])[1];
    if (type[1] === 'LightningComponentBundle') assert(path.split('/')[2].startsWith(member + '.'), 'LWC filename must match its bundle name.');
    paths.add(path); const content = string(f.content, 'File content', 200000);
    assert(!/<!DOCTYPE|<!ENTITY/i.test(content),'DTD and XML entity declarations are not allowed in generated metadata.');
    if(type[1]==='Flow')assert(xmlValue(content,'status')==='Draft','Generated Flows must remain Draft until manually reviewed and activated through the release process.');
    if(type[1]==='PermissionSet') {
      for(const match of content.matchAll(/<userPermissions>([\s\S]*?)<\/userPermissions>/g))assert(!(xmlValue(match[1],'enabled')==='true'&&['ModifyAllData','ViewAllData','AuthorApex','ManageUsers','CustomizeApplication'].includes(xmlValue(match[1],'name'))),'Generated permission sets cannot grant organization administration permissions.');
    }
    total += Buffer.byteLength(content); assert(total <= 1500000, 'Generated metadata exceeds 1.5 MB.');
    if (!types.has(type[1])) types.set(type[1], new Set()); types.get(type[1]).add(member);
    return {path, content};
  });
  for (const f of files) if (/\.cls$/.test(f.path)) assert(paths.has(f.path + '-meta.xml'), 'Every Apex class requires its metadata companion.');
  for (const name of types.get('LightningComponentBundle') || []) assert(paths.has(`lwc/${name}/${name}.js-meta.xml`) && paths.has(`lwc/${name}/${name}.js`), 'Every LWC requires JS and metadata files.');
  assert(/^\d{2}\.0$/.test(apiVersion), 'Invalid Salesforce API version.');
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n${[...types].map(([type, members]) => `<types>${[...members].map(m => `<members>${xml(m)}</members>`).join('')}<name>${type}</name></types>`).join('\n')}\n<version>${apiVersion}</version>\n</Package>`;
  files.push({path:'package.xml', content:manifest}); files.sort((a,b) => a.path.localeCompare(b.path));
  return { files, hash:hash(files), notes:string(raw.notes || 'Review all generated metadata before validation.', 'Notes', 10000) };
}
export function sourceFormat(files, root) {
  return files.filter(f => f.path !== 'package.xml').flatMap(f => {
    let path = f.path.replace(/\.flow$/, '.flow-meta.xml').replace(/\.permissionset$/, '.permissionset-meta.xml');
    if (/^objects\//.test(path)) return splitObjectSource(f,root);
    return {...f, path:`${root}/${path}`};
  });
}
export function splitObjectSource(file, root) {
  const objectName=file.path.match(/^objects\/([A-Za-z][A-Za-z\d_]*__c)\.object$/)?.[1];
  assert(objectName,'Invalid object metadata path.');
  assert(!/<!DOCTYPE|<!ENTITY/i.test(file.content),'DTD and XML entity declarations are not allowed.');
  const source=file.content.replace(/<\?xml[\s\S]*?\?>/g,'').trim();
  assert(/^<CustomObject(?:\s|>)/.test(source),'Object XML must use a CustomObject root.');
  const tokens=[...source.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:(?:"[^"]*"|'[^']*'|[^'">])*)>/g)];
  let depth=0,start=0,name='',rootOpen='',rootClose='',parts=[];
  for(const match of tokens){const token=match[0];if(token.startsWith('<!--')||token.startsWith('<!['))continue;
    if(token.startsWith('</')){depth--;assert(depth>=0,'Unbalanced object XML.');if(depth===1)parts.push({name,xml:source.slice(start,match.index+token.length)});if(depth===0)rootClose=token;}
    else {if(depth===0)rootOpen=token;if(depth===1){start=match.index;name=token.match(/^<([A-Za-z][\w]*)/)?.[1];assert(name,'Unsupported object XML namespace.');}if(!token.endsWith('/>'))depth++;else if(depth===1)parts.push({name,xml:token});}
  }
  assert(depth===0&&rootOpen&&rootClose,'Unbalanced object XML.');
  const types={fields:['fields','CustomField','field'],validationRules:['validationRules','ValidationRule','validationRule'],recordTypes:['recordTypes','RecordType','recordType'],listViews:['listViews','ListView','listView'],compactLayouts:['compactLayouts','CompactLayout','compactLayout'],businessProcesses:['businessProcesses','BusinessProcess','businessProcess'],webLinks:['webLinks','WebLink','webLink'],fieldSets:['fieldSets','FieldSet','fieldSet'],indexes:['indexes','Index','index']};
  const files=[],base=[];
  for(const part of parts){const type=types[part.name];if(!type){base.push(part.xml);continue;}const member=xmlValue(part.xml,'fullName');assert(/^[A-Za-z][A-Za-z\d_]*$/.test(member),'Invalid object child metadata name.');
    const inner=part.xml.replace(new RegExp(`^<${part.name}(?:\\s[^>]*)?>`),'').replace(new RegExp(`</${part.name}>$`),'');
    files.push({path:`${root}/objects/${objectName}/${type[0]}/${member}.${type[2]}-meta.xml`,content:`<?xml version="1.0" encoding="UTF-8"?>\n<${type[1]} xmlns="http://soap.sforce.com/2006/04/metadata">${inner}</${type[1]}>`});
  }
  files.push({path:`${root}/objects/${objectName}/${objectName}.object-meta.xml`,content:`<?xml version="1.0" encoding="UTF-8"?>\n${rootOpen}${base.join('\n')}${rootClose}`});
  assert(new Set(files.map(f=>f.path)).size===files.length,'Duplicate object child metadata.');return files;
}
export function requireStage(job, stage) { assert(job.stage === stage, `This action requires stage ${stage}. Current stage: ${job.stage}.`, 409); }
export function requireApproval(job, type) {
  const a = job.data.approvals?.[type];
  assert(a && a.hash === job.data.artifacts?.hash && a.connectionVersion === job.data.connectionVersion, 'Approval is missing or no longer matches the release or connection settings.', 409);
}
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let j=0;j<8;j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(files) {
  const local = [], central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.path), data = Buffer.from(f.content), crc = crc32(data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20,4); head.writeUInt16LE(0x800,6); head.writeUInt32LE(crc,14); head.writeUInt32LE(data.length,18); head.writeUInt32LE(data.length,22); head.writeUInt16LE(name.length,26);
    local.push(head, name, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x800,8); c.writeUInt32LE(crc,16); c.writeUInt32LE(data.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(name.length,28); c.writeUInt32LE(offset,42);
    central.push(c,name); offset += head.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
