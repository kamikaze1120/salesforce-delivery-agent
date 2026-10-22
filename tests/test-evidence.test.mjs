import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../lib/core.mjs';
import {scenarioEvidence} from '../lib/test-evidence.mjs';
test('exact reviewed Apex methods must execute; name-only, duplicates and skipped outcomes block',()=>{
 const s={id:'T',kind:'apex',apexMethods:[{className:'C',methodName:'check'}]},r={id:'T',kind:'apex',passed:true,tests:[{ApexClass:{Name:'C'},MethodName:'check',Outcome:'Pass',testRunId:'707abc',resultId:'07Mabc'}]};
 assert.equal(scenarioEvidence(s,r).status,'passed');
 for(const mutate of [r=>r.tests=[],r=>r.tests.push(r.tests[0]),r=>r.tests[0].Outcome='Skip',r=>r.tests[0].MethodName='other']){const c=structuredClone(r);mutate(c);assert.equal(scenarioEvidence(s,c).status,'blocked');}
 assert.equal(scenarioEvidence({...s,apexMethods:[]},r).status,'blocked');
});
test('browser evidence binds every reviewed step and retains explicit missing/manual status',()=>{
 const step={action:'assertText',by:'text',target:'Status',value:'Saved'},s={id:'T',kind:'browser',steps:[step]},r={id:'T',kind:'browser',passed:true,steps:[{id:'STEP-1',index:0,stepHash:hash(step),assertion:true,status:'passed'}]};
 assert.equal(scenarioEvidence(s,r).status,'passed');s.steps[0].value='Changed';assert.equal(scenarioEvidence(s,r).status,'blocked');
 assert.equal(scenarioEvidence({id:'M',kind:'manual'},{id:'M',kind:'manual',passed:true}).status,'manual');
});
