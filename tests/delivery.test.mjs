import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mockupSchema,testSuiteSchema,requireDesign,repairArtifacts} from '../lib/delivery.mjs';
import {pipelineConfig,nextStage,evidenceResult,verifyRunnerToken,readyForPipeline} from '../lib/pipeline.mjs';
import {hash,artifactsSchema} from '../lib/core.mjs';
const plan={requirements:[{id:'REQ-1',source:'Create a request'}],stories:[{id:'STORY-1'}]};
const config={enabled:true,trustedCommit:'a'.repeat(40),ref:'main',maxRepairs:2,stages:['dev','qa','uat','production'].map((name,i)=>({name,environment:name,orgId:'00D00000000000'+i,kind:name==='production'?'production':'sandbox',url:`https://test${i}.my.salesforce.com`}))};
test('mockups and tests reject invented requirement IDs, missing coverage, arbitrary URLs and scripts',()=>{
  const m=mockupSchema({screens:[{title:'Requests',description:'Create a request',requirements:['REQ-1'],fields:[],actions:[]}]},plan);
  assert.equal(m.hash,hash(m.screens));
  assert.throws(()=>mockupSchema({screens:[{title:'X',description:'Y',requirements:['REQ-2']}]},plan),/Unknown requirement/);
  assert.throws(()=>requireDesign({plan,mockup:m}),/Approve/);
  const scenario={title:'Request visible',requirements:['REQ-1'],kind:'browser',expected:'Request is visible',steps:[{action:'goto',path:'/lightning/o/Account/list'},{action:'assertVisible',by:'text',target:'Accounts'}]};
  assert.equal(testSuiteSchema({scenarios:[scenario]},plan).scenarios.length,1);
  for(const path of ['https://evil.test','//evil.test','/lightning/setup/Admin','/lightning/o/../setup'])assert.throws(()=>testSuiteSchema({scenarios:[{...scenario,steps:[{action:'goto',path}]}]},plan));
  assert.throws(()=>testSuiteSchema({scenarios:[{...scenario,steps:[{action:'evaluate',value:'steal()'}]}]},plan),/Unsupported/);
});
test('pipeline configuration requires distinct orgs, bounded repairs and production only at the last stage',()=>{
  assert.equal(pipelineConfig(config).stages.at(-1).name,'production');
  for(const change of [c=>c.maxRepairs=99,c=>c.trustedCommit='main',c=>c.stages[1].orgId=c.stages[0].orgId,c=>c.stages[0].kind='production',c=>c.stages.reverse()]){const c=structuredClone(config);change(c);assert.throws(()=>pipelineConfig(c));}
});
test('promotion requires real evidence on every earlier stage for the same artifact and rejects replay',()=>{
  const run={policy:config,artifactHash:'release-a',stages:[]};
  assert.throws(()=>nextStage(run,'production'),/Previous/);
  assert.equal(nextStage(run,'dev').name,'dev');
  run.stages.push({name:'dev',status:'passed',artifactHash:'old'});assert.throws(()=>nextStage(run,'qa'),/Previous/);
  run.stages[0].artifactHash='release-a';assert.equal(nextStage(run,'qa').name,'qa');assert.throws(()=>nextStage(run,'dev'),/already claimed/);
  assert.throws(()=>evidenceResult({status:'passed',artifactHash:'release-a',orgId:config.stages[0].orgId},run,config.stages[0]),/Quality evidence/);
});
test('repairs cannot change frozen Apex tests or permission sets',async()=>{
  const old=global.fetch;
  const artifacts=artifactsSchema({files:[{path:'classes/Request.cls',content:'public class Request {}'},{path:'classes/Request.cls-meta.xml',content:'<ApexClass/>'},{path:'classes/RequestTest.cls',content:'@IsTest private class RequestTest {}'},{path:'classes/RequestTest.cls-meta.xml',content:'<ApexClass/>'}]});
  global.fetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({files:[{path:'classes/RequestTest.cls',content:'@IsTest private class RequestTest { /* disabled */ }'}],notes:'repair'})}}]});
  try{await assert.rejects(()=>repairArtifacts({provider:'openai',model:'synthetic',token:'test'},{brd:'Create a request',plan,artifacts},{status:'failed'}),/frozen test/);}finally{global.fetch=old;}
});
test('runner identity is signed and binds repository, workflow commit, environment and delivery run',async()=>{
  const old=global.fetch;process.env.APP_ORIGIN='https://studio.example.test';
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=publicKey.export({format:'jwk'});jwk.kid='unit';
  const now=Math.floor(Date.now()/1000),run={id:'pipeline-test',policy:config};
  const claims={iss:'https://token.actions.githubusercontent.com',aud:process.env.APP_ORIGIN,nbf:now-1,iat:now,exp:now+300,repository:'owner/repo',event_name:'workflow_dispatch',ref:'refs/heads/main',workflow_sha:config.trustedCommit,workflow_ref:'owner/repo/.github/workflows/salesforce-delivery.yml@refs/heads/main',sub:'repo:owner/repo:environment:dev',run_attempt:'1',run_id:'42'};
  const token=c=>{const text=Buffer.from(JSON.stringify({alg:'RS256',kid:'unit'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url');return text+'.'+sign('RSA-SHA256',Buffer.from(text),privateKey).toString('base64url');};
  global.fetch=async url=>Response.json(String(url).includes('jwks')?{keys:[jwk]}:{display_title:'Delivery pipeline-test',head_sha:config.trustedCommit,html_url:'https://github.com/owner/repo/actions/runs/42'});
  try{
    assert.equal((await verifyRunnerToken(token(claims),{owner:'owner',repo:'repo'},run,'dev')).runId,'42');
    for(const c of [{...claims,repository:'attacker/repo'},{...claims,workflow_sha:'b'.repeat(40)},{...claims,sub:'repo:owner/repo:environment:production'},{...claims,exp:now-1},{...claims,run_attempt:'2'}])await assert.rejects(()=>verifyRunnerToken(token(c),{owner:'owner',repo:'repo'},run,'dev'));
  }finally{global.fetch=old;}
});
