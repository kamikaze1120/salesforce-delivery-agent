import {randomUUID} from 'node:crypto';
import {assert} from './core.mjs';
import {requireBusinessApproval} from './release-report.mjs';
import {github} from './integrations.mjs';
export function prepareProduction(data,now=new Date().toISOString()){
 requireBusinessApproval(data);
 const p=data.pipeline;
 assert(p.status==='awaiting_business_approval'&&!data.paused&&!data.reconciliationRequired,'Release is not ready for production continuation.',409);
 assert(!p.continuation,'Production continuation is already recorded. Reconcile uncertain dispatch instead of retrying.',409);
 assert(!p.stages.some(s=>s.name==='production'),'Production was already claimed.',409);
 return {id:randomUUID(),createdAt:now,status:'intent',approvalHash:data.businessApproval.reportHash,artifactHash:p.artifactHash};
}
export async function dispatchProduction(c,ws,job,p){
 assert(p.continuation?.status==='intent','Production continuation must be checkpointed before dispatch.',409);
 await github(c,'/actions/workflows/salesforce-production.yml/dispatches','POST',{ref:p.policy.ref,inputs:{workspace_id:ws.id,delivery_id:job.id,pipeline_id:p.id,continuation_id:p.continuation.id}});
 p.continuation.status='dispatched';
}
