import {assert} from './core.mjs';

export function claimedStage(data,name,runId){
 const stage=data.pipeline.stages.find(s=>s.name===name&&s.status==='running'&&s.runId===runId);
 assert(stage,'No matching claimed stage.',409);
 return stage;
}
export function runnerControl(data,name,runId){
 const stage=claimedStage(data,name,runId);
 return {allowed:!data.paused&&!data.reconciliationRequired&&data.pipeline.status==='running',artifactHash:stage.artifactHash};
}
export function unresolvedOperations(data){
 return (data.pipeline?.stages||[]).flatMap(s=>(s.operations||[]).filter(o=>o.phase!=='completed'));
}
// Persisted with the delivery lock and audit record before returning to the worker.
// An intent whose response is lost is deliberately not replayable.
export function recordOperation(data,name,runId,event,now=new Date().toISOString()){
 const stage=claimedStage(data,name,runId);
 assert(['validation','deployment'].includes(event?.kind),'Unsupported Salesforce operation.');
 assert(['intent','submitted','completed'].includes(event.phase),'Invalid operation phase.');
 const operations=stage.operations||[];
 const existing=operations.find(o=>o.kind===event.kind);
 if(event.phase==='intent'){
  assert(runnerControl(data,name,runId).allowed,'Delivery paused or stopped; no new operation is permitted.',409);
  assert(!existing&&!operations.some(o=>o.phase!=='completed'),'An operation is already recorded. Reconcile instead of replaying.',409);
  if(event.kind==='deployment')assert(operations.some(o=>o.kind==='validation'&&o.phase==='completed'&&o.success===true),'Successful durable validation is required before deployment.',409);
  const operation={kind:event.kind,phase:'intent',artifactHash:stage.artifactHash,runId,startedAt:now};
  stage.operations=[...operations,operation];return operation;
 }
 assert(existing&&existing.artifactHash===stage.artifactHash&&existing.runId===runId,'Operation intent is missing or stale.',409);
 assert(typeof event.id==='string'&&/^0Af[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(event.id),'Invalid Salesforce deployment ID.');
 assert(!operations.some(o=>o.kind!==event.kind&&o.id===event.id),'Deployment ID already belongs to another operation.',409);
 // Recording known outcomes remains permitted while paused. It starts no write in Salesforce.
 if(event.phase==='submitted'){
  assert(existing.phase==='intent'||existing.id===event.id,'Conflicting operation ID.',409);
  if(existing.phase==='intent')Object.assign(existing,{id:event.id,phase:'submitted',submittedAt:now});
 }else{
  assert(existing.id===event.id&&['submitted','completed'].includes(existing.phase),'Submitted operation ID does not match.',409);
  assert(typeof event.success==='boolean','Completed operation needs an explicit success outcome.');
  assert(existing.phase!=='completed'||existing.success===event.success,'Completed outcome cannot be rewritten.',409);
  if(existing.phase!=='completed')Object.assign(existing,{phase:'completed',success:event.success,completedAt:now});
 }
 return existing;
}
export function requireRecordedOutcome(stage,evidence){
 for(const kind of ['validation','deployment']){
  const op=stage.operations?.find(o=>o.kind===kind);
  assert(op?.phase==='completed'&&op.success===true&&op.id===evidence[kind]?.id,'Passing evidence must match durable Salesforce operation outcomes.',409);
 }
}
