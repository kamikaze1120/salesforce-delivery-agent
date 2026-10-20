import {assert,hash,AppError} from './core.mjs';
import {connection,lock,checkpoint,updateJob} from './store.mjs';
import {github} from './integrations.mjs';
import {verifyPipeline} from './pipeline.mjs';
import {reconciliationContext,createReconciliation,retireReconciliation} from './reconciliation.mjs';

export async function requestReconciliation(ws,original,user,name){
 const job=await lock(original,'pipeline.reconciliation.request'),data=structuredClone(job.data);let dispatched=false;
 try{
  const p=data.pipeline;
  assert(p&&p.connectionVersion===ws.connection_version&&data.connectionVersion===ws.connection_version,'Connection settings changed; recovery needs administrator investigation.',409);
  const context=reconciliationContext(data,name);
  const {config:c}=await connection(ws,'github'),policy=await verifyPipeline(c);
  assert(hash(policy)===hash(p.policy),'Reviewed runner or target policy changed.',409);
  const old=await github(c,`/actions/runs/${context.manifest.runId}`);
  assert(old.status==='completed'&&old.head_sha===p.policy.trustedCommit&&old.display_title===`Delivery ${p.id}`,'The original runner must be confirmed stopped before reconciliation.',409);
  if(p.reconciliation?.runId){const previous=await github(c,`/actions/runs/${p.reconciliation.runId}`);assert(previous.status==='completed','The previous reconciliation runner is still active.',409);}
  const workflow=await github(c,'/actions/workflows/salesforce-reconciliation.yml');
  assert(workflow.state==='active','Install the reviewed reconciliation workflow before requesting recovery.',409);
  const r=createReconciliation(data,name,user);
  // Correlation is durable before dispatch. Lost dispatch responses are not replayed.
  await checkpoint(job,job.stage,data);dispatched=true;
  await github(c,'/actions/workflows/salesforce-reconciliation.yml/dispatches','POST',{ref:p.policy.ref,inputs:{workspace_id:ws.id,delivery_id:job.id,pipeline_id:p.id,reconciliation_id:r.id,stage:name}});
  r.status='dispatched';
  return await updateJob(job,job.stage,data,user,'pipeline.reconciliation.requested');
 }catch(error){
  if(dispatched&&data.pipeline?.reconciliation)data.pipeline.reconciliation.status='dispatch_unknown';
  data.lastError=error instanceof AppError?error.message:'Reconciliation request failed. Inspect the workflow; do not redispatch an uncertain request.';
  await updateJob(job,job.stage,data,user,'pipeline.reconciliation.request.failed');throw error;
 }
}


export async function retireReconciliationRequest(ws,original,user,requestId,note){
 const job=await lock(original,'pipeline.reconciliation.retire'),data=structuredClone(job.data);
 try{
  const p=data.pipeline,r=p?.reconciliation;
  assert(p&&p.connectionVersion===ws.connection_version&&data.connectionVersion===ws.connection_version,'Connection settings changed; administrator investigation is required.',409);
  assert(r?.id===requestId,'Reconciliation request changed. Refresh before retiring it.',409);
  let workflow;
  if(r.runId){
   assert(/^[1-9][0-9]*$/.test(r.runId),'Invalid saved runner identity.',409);
   const {config:c}=await connection(ws,'github');workflow=await github(c,`/actions/runs/${r.runId}`);
  }
  retireReconciliation(data,requestId,user,note,workflow);
  return await updateJob(job,job.stage,data,user,'pipeline.reconciliation.retired');
 }catch(error){
  data.lastError=error instanceof AppError?error.message:'Retirement could not be verified. The request remains blocked.';
  await updateJob(job,job.stage,data,user,'pipeline.reconciliation.retire.failed');throw error;
 }
}
