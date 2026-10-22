import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyRunnerToken} from '../lib/pipeline.mjs';

test('production requires a signed continuation worker with exact workflow, environment and run binding',async()=>{
 const oldFetch=global.fetch,oldOrigin=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://app.example';
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk=publicKey.export({format:'jwk'});jwk.kid='production-test';
 const sha='a'.repeat(40),now=Math.floor(Date.now()/1000),config={owner:'owner',repo:'repo',token:'synthetic'};
 const target={name:'production',environment:'protected-prod'},run={id:'pipeline',continuation:{id:'continuation',status:'dispatched'},policy:{ref:'main',trustedCommit:sha,stages:[target]}};
 const claims={iss:'https://token.actions.githubusercontent.com',aud:process.env.APP_ORIGIN,exp:now+300,nbf:now-1,iat:now,repository:'owner/repo',event_name:'workflow_dispatch',ref:'refs/heads/main',workflow_sha:sha,workflow_ref:'owner/repo/.github/workflows/salesforce-production.yml@refs/heads/main',sub:'repo:owner/repo:environment:protected-prod',run_attempt:'1',run_id:'123'};
 function token(overrides={}){const payload=[{alg:'RS256',kid:jwk.kid},{...claims,...overrides}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url');}
 let remoteRun={display_title:'Production continuation',head_sha:sha,html_url:'https://github.com/owner/repo/actions/runs/123'};
 global.fetch=async url=>{if(String(url).includes('/.well-known/jwks'))return Response.json({keys:[jwk]});assert.equal(String(url),'https://api.github.com/repos/owner/repo/actions/runs/123');return Response.json(remoteRun);};
 try{
  const verified=await verifyRunnerToken(token(),config,run,'production');assert.equal(verified.runId,'123');assert.equal(verified.target,target);
  for(const overrides of [{workflow_ref:'owner/repo/.github/workflows/salesforce-delivery.yml@refs/heads/main'},{sub:'repo:owner/repo:environment:dev'},{workflow_sha:'b'.repeat(40)},{run_attempt:'2'},{aud:'https://other.example'},{exp:now-1}])await assert.rejects(()=>verifyRunnerToken(token(overrides),config,run,'production'));
  for(const wrong of [{display_title:'Delivery pipeline',head_sha:sha},{display_title:'Production other',head_sha:sha},{display_title:'Production continuation',head_sha:'b'.repeat(40)}]){remoteRun=wrong;await assert.rejects(()=>verifyRunnerToken(token(),config,run,'production'),/bound to this delivery/);}
  remoteRun={display_title:'Production continuation',head_sha:sha};
  await assert.rejects(()=>verifyRunnerToken(token(),config,{...run,continuation:undefined},'production'),/continuation is missing/);
  await assert.rejects(()=>verifyRunnerToken(token(),config,{...run,continuation:{...run.continuation,status:'completed'}},'production'),/continuation is missing/);
 }finally{global.fetch=oldFetch;if(oldOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=oldOrigin;}
});
