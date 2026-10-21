import {assert,hash,string} from './core.mjs';
import {testSuiteSchema} from './delivery.mjs';

const identifier=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const list=(v,label,min=1,max=100)=>{assert(Array.isArray(v)&&v.length>=min&&v.length<=max,`${label} requires ${min}–${max} entries.`);return v;};
const unique=(rows,label)=>assert(new Set(rows.map(x=>x.id)).size===rows.length,`Duplicate ${label} IDs.`);
export function qualityPolicy(raw,planHash,targets){
 assert(raw?.version===1&&raw.planHash===planHash&&digest(planHash),'Quality policy must identify the approved plan.');
 assert(JSON.stringify(raw).length<=200000,'Quality policy exceeds size limit.');
 string(raw.reviewReference,'Quality policy review reference',1000,10);
 assert(raw.targets&&Object.keys(raw.targets).length===targets.length&&targets.every(t=>raw.targets[t.name]===t.orgId),'Quality policy must identify every exact destination org.');
 for(const group of ['security','performance','regression']){
  list(raw[group],group);unique(raw[group],group);
  for(const c of raw[group]){
   assert(identifier(c.id),'Invalid quality case ID.');string(c.expected,'Expected quality result',2000,10);
   list(c.stages,'Case stages',1,4);assert(new Set(c.stages).size===c.stages.length&&c.stages.every(n=>targets.some(t=>t.name===n)),'Invalid case stages.');
   if(c.kind==='browser'){
    assert(group!=='security','Security cases currently require reviewed Apex authorization tests.');
    testSuiteSchema({scenarios:[{...c,title:c.id,requirements:['QUALITY']}]},{requirements:[{id:'QUALITY'}]});
    if(c.stages.includes('production'))assert(c.steps.every(s=>['goto','assertVisible','assertText'].includes(s.action)),'Production quality browser checks must be read-only.');
    if(group==='performance'){
     string(c.workload,'UI performance workload',1000,10);
     assert(c.budgets&&Object.keys(c.budgets).length===1&&Number.isFinite(c.budgets.elapsedMs)&&c.budgets.elapsedMs>0,'UI performance requires an elapsedMs budget.');
    }
    continue;
   }
   assert(!c.kind||c.kind==='apex','Unsupported quality case kind.');
   assert(identifier(c.className)&&identifier(c.method)&&digest(c.sourceHash),'Quality cases require exact Apex class, method and source hash.');
   if(group==='security')assert(['crud','fls','sharing'].includes(c.dimension)&&['allow','deny'].includes(c.access),'Security cases require CRUD/FLS/sharing and allow/deny intent.');
   if(group==='performance'){
    string(c.workload,'Performance workload',1000,10);assert(Number.isSafeInteger(c.records)&&c.records>=1,'Declare representative record volume.');
    assert(c.budgets&&Object.keys(c.budgets).length>0&&Object.entries(c.budgets).every(([key,v])=>['runtimeMs','cpuMs','queries','dml','records'].includes(key)&&Number.isFinite(v)&&v>=0),'Unsupported or invalid performance budget.');
    assert(['runtimeMs','cpuMs','queries','dml'].some(metric=>Object.hasOwn(c.budgets,metric)),'A performance case needs an operational budget, not only a record count.');
    assert(c.budgets.records===c.records,'Performance evidence must measure the reviewed record volume.');
   }
  }
 }
 for(const t of targets){
  for(const group of ['performance','regression'])assert(raw[group].some(c=>c.stages.includes(t.name)),`Missing ${group} cases for ${t.name}.`);
  for(const dimension of ['crud','fls','sharing'])for(const access of ['allow','deny'])assert(raw.security.some(c=>c.stages.includes(t.name)&&c.dimension===dimension&&c.access===access),`Missing ${dimension}/${access} security test for ${t.name}.`);
 }
 list(raw.license,'License rules');unique(raw.license,'license');
 for(const rule of raw.license){
  assert(identifier(rule.id)&&['edition','userLicense','featureLicense','packageLicense','limit','objectAccess','assignedFeature','assignedPermissionSet','connectedUserLicense'].includes(rule.kind),'Unsupported license rule.');
  string(rule.reason,'License requirement reason',1000,10);
  const url=new URL(rule.source);assert(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&['developer.salesforce.com','help.salesforce.com','www.salesforce.com'].includes(url.hostname),'License rules require an official Salesforce source.');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(rule.reviewedOn)&&Number.isFinite(Date.parse(rule.reviewedOn)),'License source review date required.');
  if(rule.kind==='edition')list(rule.allowed,'Allowed editions').forEach(v=>string(v,'Edition',100));
  else {assert(identifier(rule.key)||(['userLicense','featureLicense','assignedFeature','connectedUserLicense'].includes(rule.kind)&&typeof rule.key==='string'&&rule.key.length<=100&&rule.key.length>0),'Invalid capability key.');}
  if(['userLicense','featureLicense','packageLicense'].includes(rule.kind)){assert(Number.isSafeInteger(rule.minAvailable)&&rule.minAvailable>=0,'Declare required license capacity.');}
  if(rule.kind==='limit')assert(Number.isFinite(rule.minRemaining)&&rule.minRemaining>=0,'Declare required limit capacity.');
  if(rule.kind==='objectAccess')assert(list(rule.permissions,'Object access',1,4).every(p=>['queryable','createable','updateable','deletable'].includes(p)),'Invalid object access requirement.');
 }
 const classHashes=new Map();for(const c of [...raw.security,...raw.performance,...raw.regression]){
  if(c.kind==='browser')continue;
  assert(!classHashes.has(c.className)||classHashes.get(c.className)===c.sourceHash,'Conflicting baseline source hashes.');classHashes.set(c.className,c.sourceHash);
 }
 return structuredClone(raw);
}
export function qualityCases(policy,stage){return ['security','performance','regression'].flatMap(category=>(policy[category]||[]).filter(c=>c.stages.includes(stage)).map(c=>({...c,category})));}
export function qualityBinding(policy,artifacts,target){return {artifactHash:artifacts.hash,policyHash:hash(policy),orgId:target.orgId,stage:target.name};}
export function requireQualityBinding(evidence,policy,artifactHash,target){
 assert(policy&&evidence?.policyHash===hash(policy)&&evidence.orgId===target.orgId&&evidence.stage===target.name&&evidence.artifactHash===artifactHash,'Quality evidence belongs to another policy, release or destination.',409);
 for(const category of ['security','performance','license','regression']){
  const item=evidence.checks?.[category];
  assert(item?.status==='passed'&&item.policyHash===hash(policy)&&item.artifactHash===artifactHash&&item.orgId===target.orgId&&item.stage===target.name,'Bound quality evidence missing for '+category,409);
 }
}

export function protectQualitySources(policy,artifacts){
 for(const c of [...policy.security,...policy.performance,...policy.regression].filter(c=>c.kind!=='browser')){
  const file=artifacts.files.find(f=>f.path===`classes/${c.className}.cls`);
  assert(!file||hash(file.content)===c.sourceHash,'Generated package changes a pinned quality test source.',409);
 }
}
