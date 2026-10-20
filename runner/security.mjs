import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, delimiter} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hash} from '../lib/core.mjs';
import {metadataSecurity} from './metadata-security.mjs';

const execute=promisify(execFile);
export const securityPolicy='apex-metadata-security-v2';
const source='Salesforce Code Analyzer v5 / PMD Security';
const result=(status,reason,details={})=>({status,source,reason,policy:securityPolicy,...details});
const version=v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v);
export function securityScope(artifacts){
 if(!Array.isArray(artifacts?.files)||!artifacts.files.length||hash(artifacts.files)!==artifacts.hash)return result('blocked','Package integrity is missing or invalid.');
 const paths=artifacts.files.map(f=>f.path);
 if(new Set(paths).size!==paths.length)return result('blocked','Duplicate package paths.');
 if(artifacts.files.some(f=>typeof f.content!=='string'))return result('blocked','Invalid source content.');
 try{for(const f of artifacts.files)if(!/^classes\/[A-Za-z][A-Za-z0-9_]*\.cls$/.test(f.path))metadataSecurity(f);}catch{return result('blocked','Unsupported or unsafe metadata. This policy covers Apex, private simple custom objects and constrained permission sets; additional types fail closed.');}
 const targets=paths.filter(p=>/^classes\/[A-Za-z][A-Za-z0-9_]*\.cls$/.test(p)).sort();
 if(!targets.length&&!paths.some(p=>p.startsWith('objects/')||p.startsWith('permissionsets/')))return result('blocked','No supported implementation metadata.');
 // Native PMD suppressions can bypass Code Analyzer suppression flags. Fail closed.
 if(artifacts.files.some(f=>f.path.endsWith('.cls')&&/NOPMD|SuppressWarnings|code-analyzer-(?:suppress|unsuppress)/i.test(f.content)))return result('blocked','Inline suppression markers require review and are prohibited by this policy.');
 return {targets};
}

// Called only with output produced by the isolated runner, never model output.
export function evaluateSecurity(artifacts,observation){
 const scope=securityScope(artifacts);if(scope.status)return scope;
 const o=observation,r=o?.report;
 if(o?.artifactHash!==artifacts.hash||o?.policy!==securityPolicy||o?.exitCode!==0||o?.selector!=='pmd:Security'||o?.suppressionsDisabled!==true||JSON.stringify(o?.targets)!==JSON.stringify(scope.targets))return result('blocked','Missing, incomplete or stale scanner execution evidence.');
 if(!version(o.pluginVersion)||(!version(r?.versions?.['code-analyzer'])||r.versions['code-analyzer']!==o.pluginVersion)||!version(r?.versions?.pmd)||!Array.isArray(r?.violations)||r.violations.length>10000)return result('blocked','Malformed scanner output or missing engine versions.');
 const counts=r.violationCounts;
 if(!counts||counts.total!==r.violations.length||![1,2,3,4,5].every(n=>Number.isSafeInteger(counts['sev'+n])&&counts['sev'+n]>=0&&counts['sev'+n]===r.violations.filter(v=>v.severity===n).length)||[1,2,3,4,5].reduce((n,s)=>n+counts['sev'+s],0)!==counts.total)return result('blocked','Scanner violation counts are inconsistent.');
 if(r.violations.some(v=>v.engine!=='pmd'||typeof v.rule!=='string'||!v.rule||!Number.isInteger(v.severity)||v.severity<1||v.severity>5||!Array.isArray(v.tags)||!v.tags.includes('Security')||!Array.isArray(v.locations)||!v.locations.length||!Number.isInteger(v.primaryLocationIndex)||v.primaryLocationIndex<0||v.primaryLocationIndex>=v.locations.length))return result('blocked','Unsupported or malformed scanner findings.');
 // Retain identifiers and severity, not source excerpts or potentially sensitive messages.
 const findings=r.violations.map(v=>({engine:v.engine,rule:v.rule,severity:v.severity}));
 const details={artifactHash:artifacts.hash,targets:scope.targets,pluginVersion:o.pluginVersion,versions:r.versions,reportHash:hash(r),counts,findings};
 return result(findings.length?'failed':'passed',findings.length?'Security findings must be resolved; this policy allows no suppressions or waivers.':'All selected PMD Security rules completed without reported violations for all Apex source; structural metadata policy also passed. Runtime authorization tests remain required.',details);
}

export async function runSecurity(artifacts,options={}){
 return {...await scanSecurity(artifacts,options),artifactHash:artifacts?.hash};
}
async function scanSecurity(artifacts,{env=process.env,exec=execute}={}){
 const scope=securityScope(artifacts);if(scope.status)return scope;
 if(!scope.targets.length)return result('passed','Structural metadata policy passed; runtime access scenarios remain required.',{artifactHash:artifacts.hash,targets:[],metadataPolicy:securityPolicy});
 if(!version(env.CODE_ANALYZER_VERSION)||!env.CODE_ANALYZER_VERSION.startsWith('5.')||!env.RUNNER_TEMP)return result('blocked','Configure a reviewed exact Code Analyzer v5 version and runner temporary directory.');
 const dir=await mkdtemp(join(tmpdir(),'delivery-security-'));
 try{
  const home=join(env.RUNNER_TEMP,'delivery-analyzer-home');
  const pin=JSON.parse(await readFile(join(home,'delivery-analyzer-pin.json'),'utf8'));
  if(pin.version!==env.CODE_ANALYZER_VERSION)return result('blocked','Installed scanner does not match the reviewed version.');
  await mkdir(join(dir,'classes'));
  for(const path of scope.targets)await writeFile(join(dir,path),artifacts.files.find(f=>f.path===path).content,{mode:0o600});
  const cleanEnv={PATH:resolve('node_modules/.bin')+delimiter+(env.PATH||''),HOME:home,SF_DISABLE_TELEMETRY:'true',SFDX_DISABLE_TELEMETRY:'true',SF_AUTOUPDATE_DISABLE:'true'};
  if(env.JAVA_HOME)cleanEnv.JAVA_HOME=env.JAVA_HOME;
  // The workspace contains only fixed-path Apex source: no model-controlled configuration.
  await exec(resolve('node_modules/.bin/sf'),['code-analyzer','run','--workspace',dir,'--rule-selector','pmd:Security','--no-suppressions','--output-file',join(dir,'report.json')],{cwd:dir,env:cleanEnv,timeout:300000,maxBuffer:2e6});
  const raw=await readFile(join(dir,'report.json'),'utf8');
  if(raw.length>2e6)return result('blocked','Scanner report exceeds the evidence limit.');
  return evaluateSecurity(artifacts,{artifactHash:artifacts.hash,policy:securityPolicy,exitCode:0,selector:'pmd:Security',suppressionsDisabled:true,targets:scope.targets,pluginVersion:pin.version,report:JSON.parse(raw)});
 }catch{return result('blocked','Scanner unavailable, timed out, failed or produced unreadable output. No Salesforce write is permitted.');}
 finally{await rm(dir,{recursive:true,force:true});}
}
