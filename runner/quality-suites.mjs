import {runBrowserTests} from './browser-tests.mjs';
import {hash} from '../lib/core.mjs';
import {qualityCases,qualityBinding} from '../lib/quality-policy.mjs';

const result=(status,reason,extra={})=>({status,source:'Reviewed immutable quality baseline / observed Salesforce methods and browser assertions',reason,...extra});
// One exact observed method per approved case. Aggregate success is never enough.
export function evaluateQualitySuites(policy,artifacts,target,observations){
 const binding=qualityBinding(policy,artifacts,target),out={};
 for(const category of ['security','performance','regression']){
  const cases=qualityCases(policy,target.name).filter(c=>c.category===category);
  const rows=cases.map(c=>{
   const matches=observations.filter(o=>c.kind==='browser'?o.caseId===c.id&&o.category===category:o.className===c.className&&o.method===c.method);
   const base={id:c.id,className:c.className,method:c.method,expected:c.expected};
   if(matches.length!==1)return {...base,status:'blocked',reason:'Expected one observed method.'};
   const o=matches[0];
   if(o.testRunId)base.testRunId=o.testRunId;if(o.resultId)base.resultId=o.resultId;
   if((c.kind==='browser'?o.caseHash!==hash(c):o.sourceHash!==c.sourceHash)||o.orgId!==target.orgId||o.artifactHash!==artifacts.hash||o.policyHash!==binding.policyHash||!['Pass','Fail'].includes(o.outcome))return {...base,status:'blocked',reason:'Missing, stale, skipped or mismatched method evidence.'};
   if(o.outcome!=='Pass')return {...base,status:'failed',reason:'Required assertion method failed.'};
   if(category!=='performance')return {...base,status:'passed',reason:'Reviewed assertion method passed.',...(category==='security'?{dimension:c.dimension,access:c.access}:{}),sourceHash:o.sourceHash};
   const metrics=Object.entries(c.budgets).map(([metric,threshold])=>{
    const actual=metric==='elapsedMs'?o.elapsedMs:metric==='runtimeMs'?o.runtimeMs:o.metrics?.[metric];
    const valid=Number.isFinite(actual)&&actual>=0;
    return {metric,threshold,actual:valid?actual:null,status:!valid?'blocked':(metric==='records'?actual===threshold:actual<=threshold)?'passed':'failed'};
   });
   return {...base,workload:c.workload,metrics,status:metrics.some(m=>m.status==='blocked')?'blocked':metrics.every(m=>m.status==='passed')?'passed':'failed',reason:'Actual measurements compared with reviewed workload and budgets.'};
  });
  const status=!rows.length||rows.some(r=>r.status==='blocked')?'blocked':rows.every(r=>r.status==='passed')?'passed':'failed';
  out[category]=result(status,'All required cases must execute against the pinned baseline; skipped and missing cases block.',{...binding,cases:rows});
 }
 return out;
}
export async function runQualitySuites(policy,artifacts,target,mcp,beforeStep,{browserState,runBrowser=runBrowserTests}={}){
 const cases=qualityCases(policy,target.name),classes=[...new Set(cases.filter(c=>c.kind!=='browser').map(c=>c.className))],observations=[];
 for(const className of classes){
  await beforeStep();
  const expected=cases.find(c=>c.className===className).sourceHash;
  const before=await mcp.call('inspect_apex_source',{classes:[className]});
  if(before.sources?.length!==1||before.sources[0].className!==className||before.sources[0].hash!==expected)continue;
  const run=await mcp.call('run_apex_tests',{classes:[className]});
  const after=await mcp.call('inspect_apex_source',{classes:[className]});
  if(after.sources?.length!==1||after.sources[0].className!==className||after.sources[0].hash!==expected)continue;
  for(const row of run.tests||[]){
   if(row.ApexClass?.Name!==className||row.ApexClass?.NamespacePrefix)continue;
   observations.push({...qualityBinding(policy,artifacts,target),className,method:row.MethodName,sourceHash:expected,testRunId:row.testRunId,resultId:row.resultId,outcome:run.passed===true?row.Outcome:'Fail',runtimeMs:row.RunTime,metrics:row.qualityMetrics});
  }
 }
 for(const c of cases.filter(c=>c.kind==='browser')){
  await beforeStep();if(!browserState)continue;
  const rows=await runBrowser([{id:c.id,kind:'browser',steps:c.steps}],target,browserState,{beforeStep});
  for(const row of rows)if(row.id===c.id)observations.push({...qualityBinding(policy,artifacts,target),caseId:c.id,category:c.category,caseHash:hash(c),outcome:row.passed===true?'Pass':'Fail',elapsedMs:row.elapsedMs});
 }
 return evaluateQualitySuites(policy,artifacts,target,observations);
}
// Read only explicitly marked numeric telemetry from the observed Apex method's log.
// Raw logs and messages never leave the MCP process. Truncation/duplicates fail closed.
export function parseQualityMetrics(log,method){
 if(typeof log!=='string'||log.length>2000000||/MAXIMUM DEBUG LOG SIZE REACHED/.test(log))return null;
 const prefix='DELIVERY_QUALITY_V1:';
 const lines=log.split('\n').filter(line=>line.includes('|USER_DEBUG|')&&line.includes(prefix));
 if(lines.length!==1)return null;
 try{
  const value=JSON.parse(lines[0].slice(lines[0].indexOf(prefix)+prefix.length));
  if(value.method!==method||!['cpuMs','queries','dml','records'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0))return null;
  return Object.fromEntries(['cpuMs','queries','dml','records'].map(k=>[k,value[k]]));
 }catch{return null;}
}

export async function verifyQualitySources(policy,artifacts,target,mcp){
 const cases=qualityCases(policy,target.name).filter(c=>c.kind!=='browser');
 for(const className of [...new Set(cases.map(c=>c.className))]){
  const required=cases.filter(c=>c.className===className),file=artifacts.files.find(f=>f.path===`classes/${className}.cls`);
  if(file&&hash(file.content)!==required[0].sourceHash)return false;
  // Existing regression baselines must be observable before mutation. New security
  // and performance tests may be supplied in the approved package.
  if(!file||required.some(c=>c.category==='regression')){
   const read=await mcp.call('inspect_apex_source',{classes:[className]});
   if(read.sources?.length!==1||read.sources[0].className!==className||read.sources[0].hash!==required[0].sourceHash)return false;
  }
 }
 return true;
}
