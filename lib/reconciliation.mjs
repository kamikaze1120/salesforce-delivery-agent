import {randomUUID} from 'node:crypto';
import {assert,hash} from './core.mjs';
import {mcpPolicy} from '../runner/mcp-policy.mjs';

export function reconciliationContext(data,name){
 const p=data.pipeline,target=p?.policy?.stages.find(s=>s.name===name),stage=p?.stages.find(s=>s.name===name);
 assert(data.paused===true&&p&&target&&stage,'Pause the delivery and select a claimed stage.',409);
 assert(p.artifactHash===data.artifacts?.hash&&stage.artifactHash===p.artifactHash,'Artifact identity changed.',409);
 assert(!(stage.operations||[]).some(o=>o.phase==='intent'),'An intent has no recorded ID. Investigate the original run; no automatic reconciliation is possible.',409);
 const manifest={version:1,pipelineId:p.id,stage:name,orgId:target.orgId,targetKind:target.kind,targetUrl:target.url,artifactHash:p.artifactHash,runId:stage.runId,operations:structuredClone((stage.operations||[]).filter(o=>o.phase==='submitted'))};
 mcpPolicy('reconciliation',target,manifest);
 return {target:structuredClone(target),manifest};
}
export function createReconciliation(data,name,actor,now=new Date().toISOString()){
 const context=reconciliationContext(data,name),previous=data.pipeline.reconciliation;
 assert(!previous||previous.status==='observed','A reconciliation request already exists. Inspect its workflow before requesting another.',409);
 const request={id:randomUUID(),stage:name,status:'queued',createdAt:now,requestedBy:actor.id,context,contextHash:hash(context)};
 data.pipeline.reconciliationHistory=[...(data.pipeline.reconciliationHistory||[]),...(previous?[previous]:[])];
 data.pipeline.reconciliation=request;data.reconciliationRequired=true;
 return request;
}
export function claimReconciliation(data,requestId,runId){
 const r=data.pipeline?.reconciliation;
 assert(data.paused&&r?.id===requestId&&['queued','dispatched','dispatch_unknown','running'].includes(r.status),'Reconciliation request is inactive.',409);
 assert(!r.runId||r.runId===runId,'Another runner claimed this reconciliation.',409);
 assert(hash(r.context)===r.contextHash&&hash(reconciliationContext(data,r.stage))===r.contextHash,'Journal or target changed after reconciliation was requested.',409);
 r.runId=runId;r.status='running';return structuredClone(r.context);
}
export function recordReconciliation(data,requestId,runId,raw,now=new Date().toISOString()){
 const p=data.pipeline,r=p?.reconciliation;
 assert(data.paused&&r?.id===requestId&&r.runId===runId&&['running','observed'].includes(r.status),'Reconciliation runner is not authorized for this request.',409);
 assert(hash(r.context)===r.contextHash&&raw?.contextHash===r.contextHash,'Reconciliation context mismatch.',409);
 const saved=r.context.manifest,stage=p.stages.find(s=>s.name===r.stage),target=p.policy.stages.find(s=>s.name===r.stage);
 assert(p.id===saved.pipelineId&&p.artifactHash===saved.artifactHash&&data.artifacts?.hash===saved.artifactHash&&stage?.artifactHash===saved.artifactHash&&stage.runId===saved.runId&&hash(target)===hash(r.context.target),'Original release or target identity changed.',409);
 assert(Array.isArray(raw.results)&&raw.results.length===saved.operations.length,'Missing reconciliation observations.',409);
 const seen=new Set(),results=raw.results.map(result=>{
  const op=saved.operations.find(o=>o.id===result.id&&o.kind===result.kind);
  assert(op&&!seen.has(result.id),'Unknown or duplicated reconciliation operation.',409);seen.add(result.id);
  assert(typeof result.done==='boolean'&&typeof result.success==='boolean','Explicit operation outcome is required.',409);
  assert(result.done?['Succeeded','Failed','Canceled'].includes(result.status)&&result.success===(result.status==='Succeeded'):['Pending','InProgress','Canceling'].includes(result.status)&&result.success===false,'Inconsistent Salesforce outcome; keep the operation unresolved.',409);
  const current=stage.operations.find(o=>o.kind===op.kind);
  assert(current?.id===op.id&&current.artifactHash===op.artifactHash&&current.runId===op.runId&&['submitted','completed'].includes(current.phase),'Original operation changed.',409);
  if(current.phase==='completed')assert(result.done&&current.success===result.success,'Completed outcomes cannot be rewritten.',409);
  return {kind:result.kind,id:result.id,done:result.done,success:result.success,status:result.status};
 });
 if(r.status==='observed'){assert(hash(results)===hash(r.results),'Reconciliation observation cannot be rewritten.',409);return {status:r.status,terminal:r.results.every(x=>x.done)};}
 // Validate the entire batch before mutating any operation.
 for(const result of results){if(!result.done)continue;const op=stage.operations.find(o=>o.id===result.id);if(op.phase==='submitted')Object.assign(op,{phase:'completed',success:result.success,completedAt:now,reconciledBy:runId,reconciliationId:r.id});}
 r.status='observed';r.results=results;r.observedAt=now;
 // A remote operation result is NOT test evidence or authorization to promote.
 p.status='stopped';data.paused=true;data.reconciliationRequired=true;
 stage.status='unknown';stage.reason='Operation status was reconciled. Review remaining tests and recovery before any new delivery.';
 return {status:r.status,terminal:results.every(x=>x.done)};
}
