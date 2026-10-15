import test from 'node:test';
import assert from 'node:assert/strict';
import {recordOperation,runnerControl,unresolvedOperations,requireRecordedOutcome} from '../lib/runner-operations.mjs';
import {canRecover} from '../lib/workflow.mjs';
const id='0Af000000000001AAA',second='0Af000000000002AAA';
const state=()=>({pipeline:{status:'running',stages:[{name:'dev',status:'running',runId:'123',artifactHash:'release'}]}});
const apply=(d,event)=>recordOperation(d,'dev','123',event,'2026-10-14T12:00:00Z');
const completed=(d,kind='validation',operationId=id,success=true)=>{
 apply(d,{kind,phase:'intent'});apply(d,{kind,phase:'submitted',id:operationId});apply(d,{kind,phase:'completed',id:operationId,success});
};
test('operation intent survives interruption and prevents blind replay or recovery',()=>{
 const d=state();apply(d,{kind:'validation',phase:'intent'});
 const recovered=JSON.parse(JSON.stringify(d));
 assert.equal(unresolvedOperations(recovered)[0].phase,'intent');
 assert.throws(()=>apply(recovered,{kind:'validation',phase:'intent'}),/Reconcile/);
 assert.throws(()=>canRecover({busy:false,data:recovered}),/unresolved/);
});
test('submitted Salesforce ID persists before polling and is immutable',()=>{
 const d=state();apply(d,{kind:'validation',phase:'intent'});apply(d,{kind:'validation',phase:'submitted',id});
 const recovered=JSON.parse(JSON.stringify(d));
 assert.equal(unresolvedOperations(recovered)[0].id,id);
 assert.doesNotThrow(()=>apply(recovered,{kind:'validation',phase:'submitted',id}));
 assert.throws(()=>apply(recovered,{kind:'validation',phase:'submitted',id:second}),/Conflicting/);
 assert.throws(()=>apply(recovered,{kind:'validation',phase:'completed',id:second,success:true}),/does not match/);
});
test('pause stops new writes but permits recording already submitted outcomes',()=>{
 const d=state();apply(d,{kind:'validation',phase:'intent'});d.paused=true;
 assert.equal(runnerControl(d,'dev','123').allowed,false);
 apply(d,{kind:'validation',phase:'submitted',id});apply(d,{kind:'validation',phase:'completed',id,success:true});
 assert.equal(unresolvedOperations(d).length,0);
 assert.throws(()=>apply(d,{kind:'deployment',phase:'intent'}),/paused/);
});
test('deployment requires successful completed validation and a distinct Salesforce ID',()=>{
 const d=state();assert.throws(()=>apply(d,{kind:'deployment',phase:'intent'}),/validation/);
 completed(d,'validation',id,false);assert.throws(()=>apply(d,{kind:'deployment',phase:'intent'}),/validation/);
 const good=state();completed(good);apply(good,{kind:'deployment',phase:'intent'});
 assert.throws(()=>apply(good,{kind:'deployment',phase:'submitted',id}),/another operation/);
});
test('outcomes cannot be invented, rewritten, bound to another run, or malformed',()=>{
 const d=state();assert.throws(()=>apply(d,{kind:'validation',phase:'submitted',id}),/intent/);
 apply(d,{kind:'validation',phase:'intent'});
 for(const invalid of ['bad','../escape','005000000000001AAA',null])assert.throws(()=>apply(d,{kind:'validation',phase:'submitted',id:invalid}),/Invalid/);
 assert.throws(()=>recordOperation(d,'dev','different',{kind:'validation',phase:'submitted',id}),/claimed/);
 apply(d,{kind:'validation',phase:'submitted',id});
 assert.throws(()=>apply(d,{kind:'validation',phase:'completed',id,success:'true'}),/explicit/);
 apply(d,{kind:'validation',phase:'completed',id,success:false});
 assert.throws(()=>apply(d,{kind:'validation',phase:'completed',id,success:true}),/rewritten/);
});
test('passing stage evidence requires the exact two durable successful outcomes',()=>{
 const d=state(),stage=d.pipeline.stages[0],e={validation:{id},deployment:{id:second}};
 assert.throws(()=>requireRecordedOutcome(stage,e),/durable/);
 completed(d);completed(d,'deployment',second);
 assert.doesNotThrow(()=>requireRecordedOutcome(stage,e));
 assert.throws(()=>requireRecordedOutcome(stage,{...e,deployment:{id:'other'}}),/durable/);
});
test('stopped, paused and unreconciled deliveries fail the runner action boundary',()=>{
 for(const mutate of [d=>d.paused=true,d=>d.reconciliationRequired=true,d=>d.pipeline.status='stopped']){
  const d=state();mutate(d);assert.equal(runnerControl(d,'dev','123').allowed,false);
  assert.throws(()=>apply(d,{kind:'validation',phase:'intent'}),/paused/);
 }
});
