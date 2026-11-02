import test from 'node:test';
import assert from 'node:assert/strict';
import {notifications} from '../lib/workflow.mjs';
const job=(stage,data={})=>({id:'job-1',stage,data});
const kinds=(j,role)=>notifications(j,role).map(n=>n.kind);

test('a plan awaiting review notifies reviewers but not developers',()=>{
  const j=job('plan_review');
  assert.ok(kinds(j,'reviewer').includes('approve_plan'));
  assert.ok(kinds(j,'owner').includes('approve_plan'));
  assert.ok(!kinds(j,'developer').includes('approve_plan'));
  assert.ok(!kinds(j,'viewer').includes('approve_plan'));
});

test('unapproved generated code notifies reviewers until it is approved',()=>{
  assert.ok(kinds(job('code_review'),'reviewer').includes('approve_code'));
  assert.ok(!kinds(job('code_review',{approvals:{code:{userId:'x'}}}),'reviewer').includes('approve_code'));
});

test('a validated release awaiting deployment approval notifies reviewers',()=>{
  assert.ok(kinds(job('validated'),'owner').includes('approve_deploy'));
  assert.ok(!kinds(job('validated',{approvals:{sandbox:{userId:'x'}}}),'owner').includes('approve_deploy'));
});

test('a successful deployment prompts reviewers to record acceptance',()=>{
  assert.ok(kinds(job('sandbox_deployed'),'reviewer').includes('acceptance'));
});

test('blocking clarification questions notify developers, not reviewers',()=>{
  assert.ok(kinds(job('clarification'),'developer').includes('clarify'));
  assert.ok(!kinds(job('clarification'),'reviewer').includes('clarify'));
});

test('a self-approved gate warns the owner only',()=>{
  const j=job('code_review',{approvals:{code:{userId:'o',selfApproved:true}}});
  assert.ok(kinds(j,'owner').includes('self_approval'));
  assert.ok(!kinds(j,'developer').includes('self_approval'));
  const n=notifications(j,'owner').find(n=>n.kind==='self_approval');
  assert.equal(n.severity,'warn');
});

test('a paused delivery is visible to every role as information',()=>{
  for(const role of ['owner','reviewer','developer','viewer']) assert.ok(kinds(job('code_review',{paused:true}),role).includes('paused'));
});

test('a paused or reconciliation-blocked delivery suppresses action prompts',()=>{
  assert.ok(!kinds(job('plan_review',{paused:true}),'reviewer').includes('approve_plan'));
  assert.ok(!kinds(job('code_review',{reconciliationRequired:true}),'reviewer').includes('approve_code'));
});

test('a failed operation warns every role with the reason',()=>{
  const n=notifications(job('code_review',{lastError:'Salesforce drift detected'}),'viewer').find(n=>n.kind==='failed');
  assert.ok(n);
  assert.equal(n.severity,'warn');
  assert.match(n.message,/drift/);
});

test('a reconciliation requirement notifies reviewers',()=>{
  assert.ok(kinds(job('code_review',{reconciliationRequired:true}),'reviewer').includes('reconcile'));
  assert.ok(!kinds(job('code_review',{reconciliationRequired:true}),'developer').includes('reconcile'));
});

test('a quiet in-progress delivery produces no notifications',()=>{
  assert.deepEqual(notifications(job('approved'),'owner'),[]);
});
