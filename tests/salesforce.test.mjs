import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {cleanConfig, seal, unseal} from '../lib/core.mjs';
import {sandboxIdentity, sfTokens, deploy} from '../lib/integrations.mjs';
import {releaseChecks} from '../lib/workflow.mjs';

const orgId='00D000000000001AAA', ws={id:randomUUID()};
const config={url:'https://pilot.develop.my.salesforce.com',instanceUrl:'https://pilot.develop.my.salesforce.com',clientId:'synthetic',clientSecret:'synthetic',accessToken:'old-access',refreshToken:'old-refresh',environment:'developer',expectedOrgId:orgId};
process.env.APP_ORIGIN='http://localhost:3000';
process.env.SUPABASE_URL='https://unit-test.supabase.co';
process.env.SUPABASE_ANON_KEY='anon';
process.env.SUPABASE_SERVICE_ROLE_KEY='service';
process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');

test('Developer Edition requires explicit configuration and a matching org ID at all gates',async()=>{
  assert.equal(cleanConfig('salesforce',{...config,environment:undefined}).environment,'sandbox');
  assert.throws(()=>cleanConfig('salesforce',{...config,expectedOrgId:''}),/requires the expected/);
  assert.throws(()=>cleanConfig('salesforce',{...config,environment:'production'}),/Production is blocked/);
  const old=global.fetch;
  let org={Id:orgId,Name:'Synthetic developer org',IsSandbox:false,OrganizationType:'Developer Edition'};
  global.fetch=async(url)=>{
    assert.match(decodeURIComponent(String(url)),/OrganizationType/);
    return Response.json({records:[org]});
  };
  try {
    const identity=await sandboxIdentity(config);
    assert.equal(identity.sandbox,false);
    assert.equal(releaseChecks({orgContext:{org:identity}}).at(-1).pass,true);
    await assert.rejects(()=>sandboxIdentity({...config,environment:'sandbox'}),/Production and unverified/);
    await assert.rejects(()=>sandboxIdentity({...config,expectedOrgId:'00D000000000002AAA'}),/does not match/);
    await assert.rejects(()=>sandboxIdentity({...config,orgId:'00D000000000002AAA'}),/does not match/);
    for(const edition of ['Enterprise Edition','Unlimited Edition',undefined]) {
      org={...org,OrganizationType:edition};
      await assert.rejects(()=>sandboxIdentity(config),/Production and unverified/);
      await assert.rejects(()=>deploy(config,{hash:'synthetic',files:[]},false),/Production and unverified/);
      assert.equal(releaseChecks({orgContext:{org:{...identity,organizationType:edition}}}).at(-1).pass,false);
    }
  } finally {global.fetch=old;}
});

test('rotating tokens are claimed once across competing requests and the next token is persisted',async()=>{
  const old=global.fetch;
  let row={revision:randomUUID(),encrypted_config:seal(config,`${ws.id}:salesforce`)}, exchanges=0;
  const stale={...config};Object.defineProperty(stale,'_revision',{value:row.revision});
  global.fetch=async(url,opts)=>{
    if(String(url).includes('/services/oauth2/token')) {
      exchanges++;
      assert.equal(unseal(row.encrypted_config,`${ws.id}:salesforce`).tokenRefreshPending,true);
      return Response.json({access_token:'new-access',refresh_token:'new-refresh'});
    }
    assert.equal(opts.method,'PATCH');
    const revision=new URL(url).searchParams.get('revision').slice(3);
    if(revision!==row.revision)return Response.json([]);
    row={...row,...JSON.parse(opts.body)};
    return Response.json([row]);
  };
  try {
    const results=await Promise.allSettled([sfTokens(ws,stale),sfTokens(ws,stale)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(exchanges,1);
    const stored=unseal(row.encrypted_config,`${ws.id}:salesforce`);
    assert.equal(stored.refreshToken,'new-refresh');
    assert.equal(stored.accessToken,'new-access');
    assert.equal(stored.tokenRefreshPending,undefined);
  } finally {global.fetch=old;}
});

test('ambiguous refresh leaves a durable stop and never replays the single-use token',async()=>{
  const old=global.fetch;
  const initial={...config};Object.defineProperty(initial,'_revision',{value:randomUUID()});
  let stored,exchanges=0;
  global.fetch=async(url,opts)=>{
    if(String(url).includes('/services/oauth2/token')) {exchanges++;throw new Error('connection lost');}
    stored=unseal(JSON.parse(opts.body).encrypted_config,`${ws.id}:salesforce`);
    return Response.json([{revision:randomUUID()}]);
  };
  try {
    await assert.rejects(()=>sfTokens(ws,initial),/could not be completed/);
    await assert.rejects(()=>sfTokens(ws,stored),/outcome is unknown/);
    assert.equal(exchanges,1);
  } finally {global.fetch=old;}
});
