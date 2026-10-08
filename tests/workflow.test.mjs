import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../lib/core.mjs';
import {releaseChecks,sandboxApproval,requireSandboxApproval,canRecover,readiness} from '../lib/workflow.mjs';
const now=Date.parse('2026-10-01T12:00:00Z');
function release(){const plan={stories:[{id:'S1'}]};return {plan,planApproval:{hash:hash(plan),connectionVersion:2},connectionVersion:2,artifacts:{hash:'sha'},git:{hash:'sha',commit:'abc'},validation:{id:'0Af1',hash:'sha',result:{done:true,success:true,testErrors:0,componentErrors:0,checkedAt:new Date(now-1000).toISOString()}},orgContext:{org:{id:'00D1',sandbox:true}},jira:{S1:{key:'CRM-1'}}};}
test('release approval binds exact validation, commit, target and artifacts with expiry',()=>{
  const d=release();d.approvals={sandbox:sandboxApproval(d,'reviewer',now)};
  assert.doesNotThrow(()=>requireSandboxApproval(d,now));
  for(const mutate of [d=>d.git.commit='different',d=>d.validation.id='another',d=>d.validation.result.checkedAt=new Date(now).toISOString(),d=>d.orgContext.org.id='00D2',d=>d.artifacts.hash='changed',d=>d.connectionVersion++]){
    const copy=structuredClone(d);mutate(copy);assert.throws(()=>requireSandboxApproval(copy,now));
  }
  assert.throws(()=>requireSandboxApproval(d,now+4*3600000),/expired/);
});
test('approval refuses failed, incomplete, stale and future-dated validation or missing Jira',()=>{
  for(const mutate of [d=>d.validation.result.success=false,d=>d.validation.result.done=false,d=>d.validation.result.testErrors=1,d=>d.validation.result.componentErrors=1,d=>delete d.validation.id,d=>d.validation.result.checkedAt=new Date(now-86400001).toISOString(),d=>d.validation.result.checkedAt=new Date(now+1).toISOString(),d=>d.jira={},d=>d.plan.stories.push({id:'S2'})]){
    const d=release();mutate(d);assert.throws(()=>sandboxApproval(d,'reviewer',now));
  }
  assert.equal(releaseChecks(release(),now).every(c=>c.pass),true);
});
test('recovery refuses live leases, legacy locks, and unknown writes even after expiry',()=>{
  const job={busy:true,lease_until:new Date(now+1).toISOString(),active_operation:'analyze',data:{}};
  assert.throws(()=>canRecover(job,now),/still be running/);
  job.lease_until=new Date(now-1).toISOString();assert.doesNotThrow(()=>canRecover(job,now));
  job.active_operation='deploy';job.data.operation={phase:'write_started'};assert.throws(()=>canRecover(job,now),/unknown/);
  job.busy=false;assert.throws(()=>canRecover(job,now),/unknown/);
  job.busy=true;job.data.operation.phase='response_recorded';assert.doesNotThrow(()=>canRecover(job,now));
  delete job.active_operation;delete job.data.operation;assert.throws(()=>canRecover(job,now),/no durable outcome/);
});
test('setup distinguishes verified connections from configured model without requiring Copado',()=>{
  const checks=readiness([{type:'salesforce',verified:false},{type:'jira',verified:true},{type:'llm'},{type:'copado'}]);
  assert.equal(checks.filter(c=>c.ready).length,1);assert.equal(checks.some(c=>c.type==='copado'),false);
});
