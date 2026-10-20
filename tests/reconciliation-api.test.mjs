import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {runnerRequest} from '../lib/runner-api.mjs';
import {seal} from '../lib/core.mjs';
import {requestReconciliation} from '../lib/reconciliation-api.mjs';
process.env.APP_ORIGIN='https://app.example';process.env.SUPABASE_ANON_KEY='test';process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
const wid='00000000-0000-4000-8000-000000000001',pid='00000000-0000-4000-8000-000000000002',sha='a'.repeat(40),artifactHash='b'.repeat(64);
function fixture(){
 const policy={enabled:true,trustedCommit:sha,ref:'main',stages:['dev','qa','uat','production'].map((name,i)=>({name,environment:name,orgId:`00D00000000000${i+1}AAA`,kind:i===3?'production':'developer',url:`https://${name}.my.salesforce.com`})),maxRepairs:1};
 return {id:wid,workspace_id:wid,version:0,busy:false,stage:'code_review',data:{paused:true,connectionVersion:0,artifacts:{hash:artifactHash},pipeline:{id:pid,connectionVersion:0,status:'stopped',policy,artifactHash,stages:[{name:'dev',status:'unknown',runId:'123',artifactHash,operations:[{kind:'validation',phase:'submitted',id:'0Af000000000001AAA',artifactHash,runId:'123'}]}]}}};
}
async function harness(options,callback){
 let job=fixture();const old=global.fetch,events=[],ws={id:wid,connection_version:0},user={id:'reviewer',email:'test@example.test'};
 const config={owner:'owner',repo:'repo',token:'synthetic',pipeline:job.data.pipeline.policy};
 global.fetch=async(url,opts={})=>{
  const u=String(url),body=opts.body?JSON.parse(opts.body):null;
  if(u.includes('/rpc/claim_job')){job={...job,busy:true,version:job.version+1};return Response.json([job]);}
  if(u.includes('/rpc/finish_job')){events.push('finish');job={...job,data:body.p_data,busy:false,version:job.version+1};return Response.json([job]);}
  if(u.includes('/jobs?')){if(opts.method==='PATCH'){events.push('checkpoint');job={...job,...body};}return Response.json([job]);}
  if(u.includes('/workspaces?'))return Response.json([ws]);
  if(u.includes('/connections?'))return Response.json([{encrypted_config:seal(config,`${wid}:github`)}]);
  if(u.endsWith('/git/ref/heads/main'))return Response.json({object:{sha}});
  if(u.endsWith('/branches/main'))return Response.json({protected:true});
  if(u.endsWith('/branches/main/protection'))return Response.json({allow_force_pushes:{enabled:false},allow_deletions:{enabled:false},enforce_admins:{enabled:true},required_status_checks:{contexts:['check']}});
  if(u.includes('/environments/'))return Response.json({protection_rules:[{type:'required_reviewers',reviewers:[{id:1}],prevent_self_review:true}],deployment_branch_policy:{protected_branches:true}});
  if(u.endsWith('/actions/runs/123'))return Response.json({status:options.active?'in_progress':'completed',head_sha:sha,display_title:`Delivery ${pid}`});
  if(u.endsWith('/dispatches')){events.push('dispatch');assert.equal(job.data.pipeline.reconciliation.status,'queued');assert.equal(body.inputs.reconciliation_id,job.data.pipeline.reconciliation.id);if(options.lost)throw new Error('lost response');return new Response(null,{status:204});}
  if(u.includes('/actions/workflows/'))return Response.json({state:'active'});
  throw new Error('Unexpected endpoint '+u);
 };
 try{await callback(()=>requestReconciliation(ws,job,user,'dev'),()=>job,events);}finally{global.fetch=old;}
}
test('reviewed reconciliation dispatch checkpoints correlation before external dispatch',async()=>{
 await harness({},async(run,get,events)=>{
  const result=await run();assert.equal(result.data.pipeline.reconciliation.status,'dispatched');
  assert.deepEqual(events,['checkpoint','dispatch','finish']);assert.equal(get().data.paused,true);
  await assert.rejects(run,/already exists/);assert.equal(events.filter(x=>x==='dispatch').length,1);
 });
});
test('an active original run blocks recovery dispatch',async()=>{
 await harness({active:true},async(run,get,events)=>{await assert.rejects(run,/confirmed stopped/);assert.equal(events.includes('dispatch'),false);assert.equal(get().busy,false);});
});
test('ambiguous dispatch is retained and is never blindly replayed',async()=>{
 await harness({lost:true},async(run,get,events)=>{
  await assert.rejects(run,/could not be completed/);assert.equal(get().data.pipeline.reconciliation.status,'dispatch_unknown');
  await assert.rejects(run,/already exists/);assert.equal(events.filter(x=>x==='dispatch').length,1);
 });
});


test('authenticated recovery callbacks claim once and persist observations without promotion',async()=>{
 await harness({},async(run,get)=>{
  await run();const r=get().data.pipeline.reconciliation;
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk=publicKey.export({format:'jwk'});jwk.kid='test';
  const now=Math.floor(Date.now()/1000),claims={iss:'https://token.actions.githubusercontent.com',aud:process.env.APP_ORIGIN,exp:now+300,nbf:now-1,iat:now,repository:'owner/repo',event_name:'workflow_dispatch',ref:'refs/heads/main',workflow_sha:sha,workflow_ref:'owner/repo/.github/workflows/salesforce-reconciliation.yml@refs/heads/main',sub:'repo:owner/repo:environment:dev',run_attempt:'1',run_id:'456'};
  const payload=[{alg:'RS256',kid:'test'},claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  const req={headers:{authorization:'Bearer '+payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url')}};
  const transport=global.fetch;global.fetch=async(url,opts)=>String(url).includes('jwks')?Response.json({keys:[jwk]}):String(url).endsWith('/actions/runs/456')?Response.json({display_title:`Reconciliation ${r.id}`,head_sha:sha}):transport(url,opts);
  const base={workspaceId:wid,jobId:wid,pipelineId:pid,stage:'dev',reconciliationId:r.id};
  const context=await runnerRequest(req,{...base,action:'recoveryContext'});
  assert.equal(context.manifest.runId,'123');assert.equal(get().data.pipeline.reconciliation.runId,'456');
  const result=await runnerRequest(req,{...base,action:'recoveryReport',observation:{contextHash:context.contextHash,results:[{kind:'validation',id:'0Af000000000001AAA',done:true,success:false,status:'Failed'}]}});
  assert.equal(result.terminal,true);assert.equal(get().data.pipeline.stages[0].operations[0].success,false);
  assert.equal(get().data.reconciliationRequired,true);assert.equal(get().data.paused,true);assert.equal(get().data.pipeline.status,'stopped');
  await assert.rejects(()=>runnerRequest(req,{...base,action:'context'}));
 });
});
