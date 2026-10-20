import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {hash} from '../lib/core.mjs';
import {createReconciliation,claimReconciliation,recordReconciliation,reconciliationContext} from '../lib/reconciliation.mjs';
import {verifyRunnerToken,nextStage} from '../lib/pipeline.mjs';
import {canRecover} from '../lib/workflow.mjs';
const id='0Af000000000001AAA',pid='12345678-1234-1234-1234-123456789abc',artifactHash='a'.repeat(64),trustedCommit='b'.repeat(40);
function state(){return {paused:true,artifacts:{hash:artifactHash},pipeline:{id:pid,status:'stopped',artifactHash,policy:{ref:'main',trustedCommit,stages:[{name:'dev',environment:'dev',orgId:'00D000000000001AAA',kind:'developer',url:'https://example.my.salesforce.com'},{name:'qa'}]},stages:[{name:'dev',status:'unknown',artifactHash,runId:'123',operations:[{kind:'validation',phase:'submitted',id,artifactHash,runId:'123'}]}]}};}
const observation=(d,done=true)=>({contextHash:d.pipeline.reconciliation.contextHash,results:[{kind:'validation',id,done,success:done,status:done?'Succeeded':'InProgress'}]});
function claimed(){const d=state(),r=createReconciliation(d,'dev',{id:'reviewer'});claimReconciliation(d,r.id,'456');return d;}
test('reconciliation snapshots only recorded IDs and binds one worker to the request',()=>{
 const d=state(),r=createReconciliation(d,'dev',{id:'reviewer'});
 assert.equal(d.reconciliationRequired,true);assert.equal(r.context.manifest.runId,'123');
 assert.throws(()=>createReconciliation(d,'dev',{id:'reviewer'}),/already exists/);
 assert.throws(()=>claimReconciliation(d,'other','456'),/inactive/);
 const context=claimReconciliation(d,r.id,'456');context.manifest.operations[0].id='tampered';
 assert.equal(r.context.manifest.operations[0].id,id);
 assert.doesNotThrow(()=>claimReconciliation(d,r.id,'456'));
 assert.throws(()=>claimReconciliation(d,r.id,'789'),/Another runner/);
});
test('unsafe context and journal drift cannot be reconciled',()=>{
 for(const mutate of [d=>d.paused=false,d=>d.artifacts.hash='changed',d=>d.pipeline.stages[0].operations[0].phase='intent',d=>d.pipeline.stages[0].operations=[]]){
  const d=state();mutate(d);assert.throws(()=>reconciliationContext(d,'dev'));
 }
 const d=state(),r=createReconciliation(d,'dev',{id:'reviewer'});d.pipeline.stages[0].operations[0].id='0Af000000000002AAA';
 assert.throws(()=>claimReconciliation(d,r.id,'456'),/changed/);
});
test('terminal observations update the journal but cannot pass a stage, unlock or promote',()=>{
 const d=claimed(),r=d.pipeline.reconciliation,result=observation(d);
 assert.deepEqual(recordReconciliation(d,r.id,'456',result),{status:'observed',terminal:true});
 assert.equal(d.pipeline.stages[0].operations[0].phase,'completed');assert.equal(d.pipeline.stages[0].operations[0].reconciledBy,'456');
 assert.equal(d.paused,true);assert.equal(d.reconciliationRequired,true);assert.equal(d.pipeline.status,'stopped');assert.equal(d.pipeline.stages[0].status,'unknown');
 assert.throws(()=>nextStage(d.pipeline,'qa'),/Previous/);assert.throws(()=>canRecover({busy:false,data:d}),/controlled recovery/);
 const snapshot=hash(d);recordReconciliation(d,r.id,'456',result);assert.equal(hash(d),snapshot);
 assert.throws(()=>recordReconciliation(d,r.id,'456',{...result,results:[{...result.results[0],status:'Failed',success:false}]}),/rewritten/);
});
test('nonterminal observations remain unresolved and support a new reviewed read request',()=>{
 const d=claimed(),r=d.pipeline.reconciliation;
 assert.equal(recordReconciliation(d,r.id,'456',observation(d,false)).terminal,false);
 assert.equal(d.pipeline.stages[0].operations[0].phase,'submitted');
 const next=createReconciliation(d,'dev',{id:'reviewer'});assert.notEqual(next.id,r.id);assert.equal(d.pipeline.reconciliationHistory.length,1);
});
test('malformed, cross-run, stale and contradictory reports leave the journal unchanged',()=>{
 for(const mutate of [o=>o.contextHash='bad',o=>o.results=[],o=>o.results.push(o.results[0]),o=>o.results[0].id='0Af000000000002AAA',o=>o.results[0].kind='deployment',o=>o.results[0].success='true',o=>o.results[0].done=false,o=>o.results[0].status='Failed',o=>o.results[0].status='Unknown']){
  const d=claimed(),r=d.pipeline.reconciliation,o=observation(d);mutate(o);const before=hash(d);
  assert.throws(()=>recordReconciliation(d,r.id,'456',o));assert.equal(hash(d),before);
 }
 const d=claimed(),r=d.pipeline.reconciliation;assert.throws(()=>recordReconciliation(d,r.id,'789',observation(d)),/not authorized/);
 d.pipeline.policy.stages[0].orgId='00D000000000002AAA';assert.throws(()=>recordReconciliation(d,r.id,'456',observation(d)),/identity changed/);
});
test('signed OIDC recovery identity cannot be exchanged with a delivery workflow identity',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk=publicKey.export({format:'jwk'});jwk.kid='test';
 const d=claimed(),r=d.pipeline.reconciliation,now=Math.floor(Date.now()/1000);process.env.APP_ORIGIN='https://app.example';
 const claims={iss:'https://token.actions.githubusercontent.com',aud:process.env.APP_ORIGIN,exp:now+300,nbf:now-1,iat:now,repository:'owner/repo',event_name:'workflow_dispatch',ref:'refs/heads/main',workflow_sha:trustedCommit,workflow_ref:'owner/repo/.github/workflows/salesforce-reconciliation.yml@refs/heads/main',sub:'repo:owner/repo:environment:dev',run_attempt:'1',run_id:'456'};
 const token=c=>{const data=[{alg:'RS256',kid:'test'},c].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');};
 const old=global.fetch;global.fetch=async url=>String(url).includes('jwks')?Response.json({keys:[jwk]}):Response.json({display_title:`Reconciliation ${r.id}`,head_sha:trustedCommit,html_url:'https://github.com/owner/repo/actions/runs/456'});
 try{
  assert.equal((await verifyRunnerToken(token(claims),{owner:'owner',repo:'repo'},d.pipeline,'dev',r.id)).runId,'456');
  await assert.rejects(()=>verifyRunnerToken(token(claims),{owner:'owner',repo:'repo'},d.pipeline,'dev'));
  for(const change of [{workflow_ref:'owner/repo/.github/workflows/salesforce-delivery.yml@refs/heads/main'},{sub:'repo:owner/repo:environment:production'},{run_attempt:'2'},{workflow_sha:'c'.repeat(40)}])await assert.rejects(()=>verifyRunnerToken(token({...claims,...change}),{owner:'owner',repo:'repo'},d.pipeline,'dev',r.id));
 }finally{global.fetch=old;}
});
