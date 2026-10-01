import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {saveConnection,replaceConnection,updateJob} from '../lib/store.mjs';
const wid='00000000-0000-4000-8000-000000000001';
process.env.APP_ORIGIN='http://localhost:3000';process.env.SUPABASE_URL='https://unit-test.supabase.co';process.env.SUPABASE_ANON_KEY='anon';process.env.SUPABASE_SERVICE_ROLE_KEY='service';process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
test('stale token refresh cannot overwrite a replaced connection',async()=>{
  const old=global.fetch;global.fetch=async(url,opts)=>{assert.match(String(url),new RegExp(`revision=eq.${wid}`));assert.equal(opts.method,'PATCH');return Response.json([]);};
  try{await assert.rejects(()=>saveConnection({id:wid},'salesforce',{accessToken:'refreshed'},true,wid),/changed in another session/);}finally{global.fetch=old;}
});
test('blocked configuration transaction does not perform a separate unversioned write',async()=>{
  const old=global.fetch;let calls=0;global.fetch=async(url)=>{calls++;assert.match(String(url),/rpc\/replace_connection/);return Response.json(false);};
  try{await assert.rejects(()=>replaceConnection({id:wid,connection_version:0},'jira',{token:'secret'},{id:wid,email:'owner@example.com'}),/delivery is running/);assert.equal(calls,1);}finally{global.fetch=old;}
});
test('finishing a job submits state and actor together to the atomic database operation',async()=>{
  const old=global.fetch;global.fetch=async(url,opts)=>{assert.match(String(url),/rpc\/finish_job/);const b=JSON.parse(opts.body);assert.equal(b.p_version,5);assert.equal(b.p_actor,wid);assert.equal(b.p_data.deployment.id,'0Af1');assert.equal(b.p_action,'deploy');return Response.json([{id:wid,stage:b.p_stage}]);};
  try{const r=await updateJob({id:wid,workspace_id:wid,version:5},'deploying',{deployment:{id:'0Af1'}},{id:wid,email:'owner@example.com'},'deploy');assert.equal(r.stage,'deploying');}finally{global.fetch=old;}
});
