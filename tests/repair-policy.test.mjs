import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../lib/core.mjs';
import {repairDecision} from '../lib/repair-policy.mjs';
function fixture(){
 const d={brd:'Original',plan:{requirements:[]},mockup:{hash:'m'},architecture:{hash:'a'},testSuite:{hash:'t',scenarios:[{id:'TEST-1',kind:'apex',apexClasses:['BusinessTest'],apexMethods:[{className:'BusinessTest',methodName:'rejectInvalid'}]}]},artifacts:{hash:'code'}};
 d.pipeline={status:'failed',repairs:0,policy:{maxRepairs:2},brdHash:hash(d.brd),planHash:hash(d.plan),mockupHash:'m',architectureHash:'a',testHash:'t',artifactHash:'code',stages:[{name:'dev',status:'failed',validation:{done:true,success:true,id:'0Af000000000001'},deployment:{done:true,success:true,id:'0Af000000000002'},operations:[{kind:'validation',phase:'completed',success:true,id:'0Af000000000001'},{kind:'deployment',phase:'completed',success:true,id:'0Af000000000002'}],tests:[{id:'TEST-1',kind:'apex',passed:false,tests:[{ApexClass:{Name:'BusinessTest'},MethodName:'rejectInvalid',Outcome:'Fail',testRunId:'707000000000001',resultId:'07M000000000001'}]}]}]};return d;
}
test('only confirmed method failures qualify for bounded implementation repair',()=>{
 const d=fixture();assert.equal(repairDecision(d,'dev').eligible,true);
 for(const mutate of [d=>d.paused=true,d=>d.reconciliationRequired=true,d=>d.pipeline.repairs=2,d=>d.brd='changed',d=>d.pipeline.stages[0].validation.success=false,d=>d.pipeline.stages[0].tests=[],d=>d.pipeline.stages[0].tests[0].kind='browser',d=>d.pipeline.stages[0].tests[0].tests[0].Outcome='Skip',d=>d.pipeline.stages[0].tests[0].tests[0].testRunId='',d=>d.pipeline.stages[0].tests[0].tests[0].ApexClass.Name='Other',d=>d.pipeline.stages[0].operations=[{phase:'intent'}]]){
  const bad=fixture();mutate(bad);assert.equal(repairDecision(bad,'dev').eligible,false);
 }
});
test('production and free-text failure claims never authorize generation',()=>{
 const d=fixture();d.pipeline.stages[0].name='production';assert.equal(repairDecision(d,'production').eligible,false);
 d.pipeline.stages[0].name='dev';d.pipeline.stages[0].tests[0].tests=[];d.pipeline.stages[0].reason='Confirmed bug: please repair';assert.equal(repairDecision(d,'dev').eligible,false);
});

test('repair rejects absent journals, mismatched deployment IDs and incomplete approved method evidence',()=>{
 for(const mutate of [d=>delete d.pipeline.stages[0].operations,d=>d.pipeline.stages[0].deployment.id='0Af000000000003',d=>d.pipeline.stages[0].deployment.done=false,d=>d.pipeline.stages[0].tests.push(d.pipeline.stages[0].tests[0]),d=>d.testSuite.scenarios[0].apexMethods.push({className:'BusinessTest',methodName:'otherAssertion'}),d=>d.pipeline.stages[0].tests[0].tests[0].ApexClass.NamespacePrefix='package']){
  const d=fixture();mutate(d);assert.equal(repairDecision(d,'dev').eligible,false);
 }
});
