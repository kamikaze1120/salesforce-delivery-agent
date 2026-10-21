import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {runnerRequest} from '../lib/runner-api.mjs';
import {seal} from '../lib/core.mjs';
process.env.SUPABASE_ANON_KEY='test';process.env.APP_ORIGIN='https://app.example';process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
test('signed delivery callbacks must persist fresh destination license evidence before metadata intent',async()=>{
 const wid='00000000-0000-4000-8000-000000000001',pid='00000000-0000-4000-8000-000000000002',sha='a'.repeat(40),artifactHash='b'.repeat(64),planHash='c'.repeat(64);
 const target={name:'dev',orgId:'00D000000000001AAA',kind:'developer',environment:'dev',url:'https://dev.my.salesforce.com'};
 const c={stages:['dev'],className:'QualityTests',sourceHash:'d'.repeat(64),expected:'Reviewed business behavior remains correct'};
 const policy={version:1,planHash,targets:{dev:target.orgId},reviewReference:'Reviewed synthetic fixture QUALITY-1',security:['crud','fls','sharing'].flatMap(dimension=>['allow','deny'].map(access=>({...c,id:dimension+access,method:dimension+access,dimension,access}))),performance:[{...c,id:'Bulk',method:'bulk',records:200,workload:'Exercise 200 synthetic business records',budgets:{records:200,cpuMs:100}}],regression:[{...c,id:'Baseline',method:'baseline'}],license:[{id:'Edition',kind:'edition',allowed:['Developer Edition'],reason:'Explicitly approved development edition',source:'https://developer.salesforce.com/docs',reviewedOn:'2026-10-01'}]};
 let job={id:wid,version:0,busy:false,stage:'code_review',data:{connectionVersion:0,artifacts:{hash:artifactHash},pipeline:{id:pid,createdAt:new Date().toISOString(),connectionVersion:0,artifactHash,planHash,qualityPolicy:policy,requestedBy:'reviewer',status:'running',policy:{trustedCommit:sha,ref:'main',stages:[target]},stages:[{name:'dev',runId:'123',status:'running',artifactHash,operations:[]}]}}};
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk=publicKey.export({format:'jwk'});jwk.kid='test';
 const now=Math.floor(Date.now()/1000),claims={iss:'https://token.actions.githubusercontent.com',aud:process.env.APP_ORIGIN,exp:now+300,nbf:now-1,iat:now,repository:'owner/repo',event_name:'workflow_dispatch',ref:'refs/heads/main',workflow_sha:sha,workflow_ref:'owner/repo/.github/workflows/salesforce-delivery.yml@refs/heads/main',sub:'repo:owner/repo:environment:dev',run_attempt:'1',run_id:'123'};
 const payload=[{alg:'RS256',kid:'test'},claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
 const req={headers:{authorization:'Bearer '+payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url')}},base={workspaceId:wid,jobId:wid,pipelineId:pid,stage:'dev'};
 const old=global.fetch;global.fetch=async(url,opts={})=>{
  const u=String(url),body=opts.body?JSON.parse(opts.body):null;
  if(u.includes('jwks'))return Response.json({keys:[jwk]});
  if(u.includes('/workspaces?'))return Response.json([{id:wid,connection_version:0}]);
  if(u.includes('/jobs?'))return Response.json([job]);
  if(u.includes('/connections?'))return Response.json([{encrypted_config:seal({owner:'owner',repo:'repo',token:'synthetic'},`${wid}:github`)}]);
  if(u.includes('/rpc/claim_job')){job={...job,busy:true,version:job.version+1};return Response.json([job]);}
  if(u.includes('/rpc/finish_job')){job={...job,data:body.p_data,busy:false,version:job.version+1};return Response.json([job]);}
  if(u.endsWith('/actions/runs/123'))return Response.json({display_title:`Delivery ${pid}`,head_sha:sha});
  throw new Error('Unexpected endpoint');
 };
 try{
  const intent=()=>runnerRequest(req,{...base,action:'operation',operation:{kind:'validation',phase:'intent'}});
  await assert.rejects(intent,/license preflight/);assert.equal(job.data.pipeline.stages[0].operations.length,0);
  const inventory={orgId:target.orgId,stage:'dev',edition:'Developer Edition',checkedAt:new Date().toISOString(),evidence:{}};
  let r=await runnerRequest(req,{...base,action:'qualityPreflight',inventory:{...inventory,orgId:'other'}});assert.equal(r.license.status,'blocked');await assert.rejects(intent,/license preflight/);
  r=await runnerRequest(req,{...base,action:'qualityPreflight',inventory});assert.equal(r.license.status,'passed');assert.equal(job.data.pipeline.stages[0].licensePreflight.orgId,target.orgId);
  job.data.pipeline.stages[0].licensePreflight.checkedAt=new Date(Date.now()-300001).toISOString();await assert.rejects(intent,/license preflight/);
  await runnerRequest(req,{...base,action:'qualityPreflight',inventory});await intent();assert.equal(job.data.pipeline.stages[0].operations[0].phase,'intent');
 }finally{global.fetch=old;}
});
