import {hash} from './core.mjs';
export function scenarioEvidence(scenario,result){
 const blocked={status:'blocked',reason:'Required assertion-level evidence is missing, duplicated or stale.'};
 if(!result||result.id!==scenario.id||result.kind!==scenario.kind)return blocked;
 if(scenario.kind==='manual')return {status:'manual',reason:'Human evidence cannot satisfy automated execution.'};
 if(scenario.kind==='browser'){
  if(!Array.isArray(result.steps)||result.steps.length!==scenario.steps.length||!scenario.steps.some(s=>s.action.startsWith('assert')))return blocked;
  if(scenario.steps.some((s,i)=>result.steps[i].index!==i||result.steps[i].stepHash!==hash(s)||!['passed','failed','blocked','skipped'].includes(result.steps[i].status)))return blocked;
  if(result.steps.some(s=>['blocked','skipped'].includes(s.status)))return blocked;
  return {status:result.steps.every(s=>s.status==='passed')&&result.passed===true?'passed':'failed',assertions:result.steps.filter(s=>s.assertion).map(s=>({id:s.id,status:s.status,stepHash:s.stepHash}))};
 }
 if(scenario.kind==='apex'){
  if(!scenario.apexMethods?.length||!Array.isArray(result.tests))return blocked;
  const methods=scenario.apexMethods.map(m=>({method:m,results:result.tests.filter(t=>t.ApexClass?.Name===m.className&&!t.ApexClass?.NamespacePrefix&&t.MethodName===m.methodName)}));
  if(methods.some(m=>m.results.length!==1||!m.results[0].testRunId||!m.results[0].resultId||!['Pass','Fail'].includes(m.results[0].Outcome)))return blocked;
  return {status:result.passed===true&&methods.every(m=>m.results[0].Outcome==='Pass')?'passed':'failed',assertions:methods.map(m=>({...m.method,status:m.results[0].Outcome==='Pass'?'passed':'failed',testRunId:m.results[0].testRunId,resultId:m.results[0].resultId}))};
 }
 return blocked;
}
