import {requireArchitecture} from './architecture.mjs';
import {requireQuality} from './quality.mjs';
import {randomUUID,createPublicKey,verify} from 'node:crypto';
import {assert,hash,string,uuid,origin} from './core.mjs';
import {github,remote} from './integrations.mjs';
import {requireDesign} from './delivery.mjs';

export const stageNames=['dev','qa','uat','production'];
export function pipelineConfig(raw={}){
  const c=typeof raw==='string'?JSON.parse(raw||'{}'):raw;
  if(!c.enabled)return {enabled:false};
  assert(/^[a-f0-9]{40}$/.test(c.trustedCommit),'Pin the reviewed runner commit (40-character SHA).');
  assert(/^[A-Za-z0-9_/-]+$/.test(c.ref||'')&&!c.ref.includes('..'),'Invalid workflow branch.');
  const stages=c.stages;assert(Array.isArray(stages)&&stages.length===4&&new Set(stages.map(s=>s.name)).size===4&&stageNames.every((n,i)=>stages[i].name===n),'Configure four unique stages in order: dev, qa, uat, production.');
  const clean=stages.map(s=>{
    assert(/^[A-Za-z0-9_-]{1,50}$/.test(s.environment),'Invalid GitHub environment name.');
    assert(/^00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(s.orgId),'Every stage needs an expected Salesforce org ID.');
    assert(['sandbox','developer','production'].includes(s.kind)&&((s.name==='production')===(s.kind==='production')),'Only the production stage may target a production org.');
    return {name:s.name,environment:s.environment,orgId:s.orgId,kind:s.kind,url:origin(s.url,'Salesforce')};
  });
  assert(new Set(clean.map(s=>s.orgId.slice(0,15))).size===4,'Use a distinct Salesforce org for every stage.');
  assert(Number.isInteger(c.maxRepairs)&&c.maxRepairs>=0&&c.maxRepairs<=3,'Automatic repairs must be between 0 and 3.');
  return {enabled:true,trustedCommit:c.trustedCommit,ref:c.ref,stages:clean,maxRepairs:c.maxRepairs};
}
export function readyForPipeline(data){
  requireDesign(data);requireArchitecture(data);
  assert(data.planApproval?.hash===hash(data.plan)&&data.planApproval.connectionVersion===data.connectionVersion,'Approve the current plan.',409);
  assert(data.approvals?.code?.hash===data.artifacts?.hash&&data.approvals.code.connectionVersion===data.connectionVersion,'Approve the current implementation.',409);
  assert(data.testSuite?.scenarios.every(s=>s.kind!=='manual'),'Resolve manual-only test scenarios before starting an automatic pipeline.',409);
  assert(data.testSuite&&data.testApproval?.hash===data.testSuite.hash&&data.testApproval.artifactHash===data.artifacts.hash,'Review and approve the test suite.',409);
  assert(data.plan.stories.every(s=>data.jira?.[s.id]),'Create every Jira story before starting the pipeline.',409);
  assert(data.git?.hash===data.artifacts.hash,'Commit the reviewed implementation first.',409);
}
export async function verifyPipeline(c){
  const p=pipelineConfig(c.pipeline);assert(p.enabled,'Enable and configure the CI/CD pipeline.',409);
  const head=await github(c,`/git/ref/heads/${encodeURIComponent(p.ref)}`);
  assert(head.object?.sha===p.trustedCommit,'The runner branch changed. Review and pin its current commit.',409);
  const branch=await github(c,`/branches/${encodeURIComponent(p.ref)}`);assert(branch.protected===true,'Protect the runner branch before enabling CI/CD.',409);
  const protection=await github(c,`/branches/${encodeURIComponent(p.ref)}/protection`);
  assert(protection.allow_force_pushes?.enabled===false&&protection.allow_deletions?.enabled===false&&protection.enforce_admins?.enabled===true&&((protection.required_status_checks?.checks?.length||0)+(protection.required_status_checks?.contexts?.length||0)>0),'Runner branch must block force pushes/deletion, enforce rules for administrators and require status checks.',409);
  const workflow=await github(c,'/actions/workflows/salesforce-delivery.yml');assert(workflow.state==='active','Install and enable the trusted Salesforce delivery workflow.',409);
  for(const s of p.stages){
    const env=await github(c,`/environments/${encodeURIComponent(s.environment)}`);
    if(['uat','production'].includes(s.name))assert(env.protection_rules?.some(r=>r.type==='required_reviewers'&&r.reviewers?.length&&r.prevent_self_review===true),'UAT and production require GitHub environment reviewers with self-review prevented.',409);
    assert(env.deployment_branch_policy?.protected_branches===true,'Restrict each environment to protected branches.',409);
  }
  return p;
}
export async function dispatchPipeline(c,ws,job,data,actor){
  const policy=await verifyPipeline(c);
  assert(policy.stages[0].orgId.slice(0,15)===data.orgContext?.org?.id?.slice(0,15),'The first pipeline org must match the development org used to review this delivery.',409);
  const old=data.pipeline;
  assert(!old||['failed','complete','stopped'].includes(old.status),'A pipeline is already active.',409);
  const run={id:randomUUID(),status:'queued',policy,artifactHash:data.artifacts.hash,testHash:data.testSuite.hash,brdHash:hash(data.brd),planHash:hash(data.plan),mockupHash:data.mockup.hash,architectureHash:data.architecture.hash,connectionVersion:data.connectionVersion,createdAt:new Date().toISOString(),requestedBy:actor.id,attempt:(old?.attempt||0)+1,repairs:old?.repairs||0,stages:[],history:[...(old?.history||[]),...(old?[{id:old.id,status:old.status,artifactHash:old.artifactHash,stages:old.stages}]:[])]};
  return run;
}
export async function sendDispatch(c,ws,job,run){
  return github(c,'/actions/workflows/salesforce-delivery.yml/dispatches','POST',{ref:run.policy.ref,inputs:{workspace_id:ws.id,delivery_id:job.id,pipeline_id:run.id,stage_order:JSON.stringify(run.policy.stages.map(s=>s.name))}});
}
export async function verifyRunnerToken(token,c,run,stage){
  assert(typeof token==='string'&&token.length<20000,'Runner identity required.',401);
  let header,claims,parts;try{parts=token.split('.');header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{assert(false,'Invalid runner identity.',401);}
  assert(parts.length===3&&header.alg==='RS256','Invalid runner identity.',401);
  const keys=await remote('https://token.actions.githubusercontent.com/.well-known/jwks',{},'GitHub identity');
  const key=keys.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');assert(key,'Unknown runner signing key.',401);
  assert(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url')),'Invalid runner signature.',401);
  const now=Math.floor(Date.now()/1000),repo=`${c.owner}/${c.repo}`,p=run.policy;
  assert(claims.iss==='https://token.actions.githubusercontent.com'&&claims.aud===process.env.APP_ORIGIN&&claims.exp>now&&claims.nbf<=now+30&&claims.iat<=now+30,'Expired or mismatched runner identity.',401);
  assert(claims.repository===repo&&claims.event_name==='workflow_dispatch'&&claims.ref===`refs/heads/${p.ref}`&&claims.workflow_sha===p.trustedCommit&&claims.workflow_ref===`${repo}/.github/workflows/salesforce-delivery.yml@refs/heads/${p.ref}`,'Runner workflow identity differs from the reviewed pipeline.',403);
  const target=p.stages.find(s=>s.name===stage);assert(target&&claims.sub===`repo:${repo}:environment:${target.environment}`,'Runner environment is not authorized.',403);
  assert(String(claims.run_attempt)==='1','Workflow re-runs require a new pipeline request.',403);
  const ghRun=await github(c,`/actions/runs/${claims.run_id}`);
  assert(ghRun.display_title===`Delivery ${run.id}`&&ghRun.head_sha===p.trustedCommit,'Runner is not bound to this delivery.',403);
  return {target,runId:String(claims.run_id),url:ghRun.html_url};
}
export function nextStage(run,name){
  const idx=run.policy.stages.findIndex(s=>s.name===name);
  assert(idx>=0&&run.policy.stages.slice(0,idx).every(s=>run.stages.some(r=>r.name===s.name&&r.status==='passed'&&r.artifactHash===run.artifactHash)),'Previous pipeline stages have not passed for this artifact.',409);
  assert(!run.stages.some(s=>s.name===name),'Stage already claimed. Reconcile interrupted runs instead of replaying a deployment.',409);
  return run.policy.stages[idx];
}
export function evidenceResult(raw,run,target){
  assert(raw&&raw.artifactHash===run.artifactHash&&raw.orgId?.slice(0,15)===target.orgId.slice(0,15),'Runner evidence target or artifact mismatch.',409);
  const statuses=['passed','failed','unknown'];assert(statuses.includes(raw.status),'Invalid runner outcome.');
  if(raw.status==='passed')requireQuality(raw.quality,run.artifactHash);
  if(raw.status==='passed')assert(raw.validation?.done===true&&raw.validation.success===true&&raw.deployment?.done===true&&raw.deployment.success===true&&raw.tests?.length>0&&raw.tests.every(t=>t.passed===true),'Passing evidence requires completed validation, deployment, and tests.',409);
  return {status:raw.status,artifactHash:run.artifactHash,orgId:target.orgId,validation:raw.validation,deployment:raw.deployment,tests:raw.tests,quality:raw.quality,reason:string(raw.reason||'Runner completed.','Runner result',2000),at:new Date().toISOString()};
}
