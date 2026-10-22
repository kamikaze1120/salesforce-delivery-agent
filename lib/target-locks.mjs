import {assert} from './core.mjs';
import {db} from './store.mjs';
export const pipelineLockScope=(p,stage,runId)=>`pipeline:${p.id}:${stage}:${runId}`;
export async function acquireTarget(job,orgId,scope,artifactHash,query=db){
 assert(await query('rpc/acquire_target_org','','POST',{p_workspace:job.workspace_id,p_job:job.id,p_org:orgId,p_scope:scope,p_artifact:artifactHash})===true,'Salesforce org is locked by another operation, or the target-lock migration is missing. Reconcile before retrying.',409);
}
export async function releaseTarget(job,orgId,scope,query=db){
 return await query('rpc/release_target_org','','POST',{p_workspace:job.workspace_id,p_job:job.id,p_org:orgId,p_scope:scope})===true;
}
// A failed release retains the lock. Never weaken an uncertain org lock to make progress.
export async function tryReleaseTarget(job,orgId,scope){try{return await releaseTarget(job,orgId,scope);}catch{return false;}}
