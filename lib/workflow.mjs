import { assert, hash } from './core.mjs';

export function readiness(connections) {
  return ['salesforce','jira','github','llm','copado'].map(type => {
    const c=connections.find(c=>c.type===type);
    const ready=Boolean(c && (type==='copado' || c.verified));
    return {type,ready,message:!c?'Add connection':type==='copado'?'Manual handoff configured':c.verified?'Verified':'Verify connection'};
  });
}
export function releaseChecks(data, now=Date.now()) {
  const result=data.validation?.result;
  return [
    {name:'Current plan approved',pass:!!data.plan && data.planApproval?.hash===hash(data.plan) && data.planApproval?.connectionVersion===data.connectionVersion},
    {name:'Exact artifacts committed',pass:!!data.artifacts?.hash && data.git?.hash===data.artifacts.hash && !!data.git?.commit},
    {name:'Validation passed within 24 hours',pass:!!data.validation?.id && result?.done===true && result.success===true && Number(result.testErrors || 0)===0 && Number(result.componentErrors || 0)===0 && data.validation?.hash===data.artifacts?.hash && Date.parse(result.checkedAt)>now-86400000 && Date.parse(result.checkedAt)<=now},
    {name:'All Jira stories linked',pass:!!data.plan?.stories?.length && data.plan.stories.every(s=>!!data.jira?.[s.id])},
    {name:'Sandbox target identified',pass:!!data.orgContext?.org?.id && data.orgContext.org.sandbox===true}
  ];
}
export function sandboxApproval(data,userId,now=Date.now()) {
  const failed=releaseChecks(data,now).filter(c=>!c.pass);
  assert(!failed.length,failed.map(c=>c.name).join('; '),409);
  return {userId,at:new Date(now).toISOString(),expiresAt:new Date(now+4*3600000).toISOString(),hash:data.artifacts.hash,connectionVersion:data.connectionVersion,orgId:data.orgContext.org.id,gitCommit:data.git.commit,validationId:data.validation.id,validationCheckedAt:data.validation.result.checkedAt};
}
export function requireSandboxApproval(data,now=Date.now()) {
  const failed=releaseChecks(data,now).filter(c=>!c.pass);
  assert(!failed.length,failed.map(c=>c.name).join('; '),409);
  const a=data.approvals?.sandbox;
  assert(a && Date.parse(a.expiresAt)>now && a.hash===data.artifacts.hash && a.connectionVersion===data.connectionVersion && a.orgId===data.orgContext.org.id && a.gitCommit===data.git.commit && a.validationId===data.validation.id && a.validationCheckedAt===data.validation.result.checkedAt,'Sandbox approval expired or its release evidence changed. Request a fresh review.',409);
}
export function canRecover(job,now=Date.now()) {
  assert(!job.busy || Date.parse(job.lease_until || job.updated_at)+(!job.lease_until?600000:0)<=now,'The operation may still be running. Wait for the ten-minute lease to expire before recovery.',409);
  assert(job.data.operation?.phase!=='write_started','The external write outcome is unknown. Keep this delivery paused and reconcile the external system; automatic retry is blocked.',409);
  // Legacy locked writes have no reliable checkpoint and cannot safely be retried.
  assert(!job.busy || job.active_operation && !['jira','git','validate','deploy'].includes(job.active_operation) || job.data.operation?.phase==='response_recorded','This interrupted write has no durable outcome. Administrator reconciliation is required before it can be retried.',409);
}
