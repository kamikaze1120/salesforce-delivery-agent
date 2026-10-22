import {hash} from './core.mjs';
import {unresolvedOperations} from './runner-operations.mjs';

// Classification is deterministic; free-text reasons and model suggestions never authorize repair.
export function repairDecision(data,stageName){
 const p=data.pipeline,s=p?.stages?.find(s=>s.name===stageName);
 const deny=(category,action)=>({eligible:false,category,action});
 if(data.reconciliationRequired||unresolvedOperations(data).length||s?.status==='unknown')return deny('uncertain_operation','Reconcile recorded Salesforce operations; do not resubmit.');
 if(data.paused)return deny('paused','A reviewer must resume the delivery.');
 if(!p||!s||p.status!=='failed'||s.status!=='failed')return deny('no_confirmed_defect','Obtain a completed, failed test result.');
 if(stageName==='production')return deny('production','Follow the reviewed post-deployment recovery plan.');
 if(!Number.isInteger(p.repairs)||p.repairs>=p.policy.maxRepairs)return deny('budget_exhausted','Review the failure and approve a new implementation.');
 if(hash(data.brd)!==p.brdHash||hash(data.plan)!==p.planHash||data.mockup?.hash!==p.mockupHash||data.testSuite?.hash!==p.testHash||data.architecture?.hash!==p.architectureHash||data.artifacts?.hash!==p.artifactHash)return deny('changed_expectations','Reapprove the changed release; original expectations cannot be rewritten during repair.');
 // Deployment errors can be permissions, dependencies, licenses, or locks. Do not infer a code bug.
 if(s.validation?.success!==true||s.deployment?.success!==true)return deny('deployment_or_setup','Resolve deployment diagnostics, permissions and dependencies before deciding on a code change.');
 const required=data.testSuite.scenarios;
 if(!Array.isArray(s.tests)||required.some(c=>!s.tests.some(t=>t.id===c.id)))return deny('missing_evidence','Run every required test and retain its result.');
 const failures=s.tests.filter(t=>t.passed!==true);
 if(!failures.length)return deny('quality_policy','Review quality policy, entitlements and measurements; do not repair from a category label.');
 // Only exact failed Apex methods from the approved class list qualify. Browser failures are ambiguous
 // until locator/session/network diagnostics can distinguish application defects from missing setup.
 for(const t of failures){
  const scenario=required.find(c=>c.id===t.id);
  if(!scenario||t.kind!=='apex'||scenario.kind!=='apex'||!Array.isArray(t.tests)||!t.tests.length)return deny('test_infrastructure','Inspect test setup, browser sessions and locators; no confirmed code defect.');
  if(t.tests.some(m=>!scenario.apexClasses.includes(m.ApexClass?.Name)||!['Pass','Fail'].includes(m.Outcome)||!/^707[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(m.testRunId||'')||!m.resultId||!m.MethodName)||!t.tests.some(m=>m.Outcome==='Fail'))return deny('missing_evidence','Obtain exact method-level pass/fail results from the authenticated test run.');
 }
 return {eligible:true,category:'apex_test_defect',action:'Repair implementation against frozen requirements and tests, then restart validation from Dev.',failedScenarios:failures.map(t=>t.id),remaining:p.policy.maxRepairs-p.repairs};
}
