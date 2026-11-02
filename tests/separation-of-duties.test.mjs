import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {sodMode, sodDecision} from '../lib/workflow.mjs';
import {handler} from '../lib/handler.mjs';
import {seal} from '../lib/core.mjs';
process.env.APP_ORIGIN='http://localhost:3000';
process.env.SUPABASE_URL='https://unit-test.supabase.co';
process.env.SUPABASE_ANON_KEY='anon';
process.env.SUPABASE_SERVICE_ROLE_KEY='service';
process.env.ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
async function hrequest(op, body, headers = {}) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = body ? 'POST' : 'GET'; req.url = '/api/service?op=' + op; req.headers = headers;
  let response = {headers:{}, status:0, body:null};
  const res = {setHeader(k,v){response.headers[k]=v;}, set statusCode(s){response.status=s;}, end(b){response.body=b?JSON.parse(b):null;}};
  await handler(req, res); return response;
}

test('sodMode defaults to warn and only enforces on an exact enforce setting', () => {
  assert.equal(sodMode(undefined), 'warn');
  assert.equal(sodMode({}), 'warn');
  assert.equal(sodMode({sod_mode: null}), 'warn');
  assert.equal(sodMode({sod_mode: 'anything-else'}), 'warn');
  assert.equal(sodMode({sod_mode: 'warn'}), 'warn');
  assert.equal(sodMode({sod_mode: 'enforce'}), 'enforce');
});

test('warn mode flags a self-approval but does not block it', () => {
  // Author approving their own code: allowed, but recorded as self-approved.
  const decision = sodDecision('warn', 'user-author', ['user-author']);
  assert.equal(decision.selfApproved, true);
});

test('warn mode does not flag an independent approver', () => {
  const decision = sodDecision('warn', 'user-reviewer', ['user-author']);
  assert.equal(decision.selfApproved, false);
});

test('enforce mode blocks a self-approval with a 403', () => {
  assert.throws(
    () => sodDecision('enforce', 'user-author', ['user-author']),
    err => err.status === 403 && /separation of duties/i.test(err.message)
  );
});

test('enforce mode allows an independent approver', () => {
  const decision = sodDecision('enforce', 'user-reviewer', ['user-author']);
  assert.equal(decision.selfApproved, false);
});

test('deploy conflicts with the prior code approver, not only the author', () => {
  // The person who approved the code cannot also approve the deployment.
  assert.equal(sodDecision('warn', 'user-reviewer', ['user-author', 'user-reviewer']).selfApproved, true);
  assert.throws(() => sodDecision('enforce', 'user-reviewer', ['user-author', 'user-reviewer']), err => err.status === 403);
});

test('null or undefined conflicting ids never produce a false self-approval', () => {
  // When no author is recorded yet, an approval must not be wrongly flagged.
  assert.equal(sodDecision('warn', 'user-reviewer', [undefined, null]).selfApproved, false);
  assert.doesNotThrow(() => sodDecision('enforce', 'user-reviewer', [undefined, null]));
});

test('handler: in warn mode an author approving their own code is allowed, flagged, and audited', async () => {
  const old = global.fetch; const wid = '00000000-0000-4000-8000-000000000001';
  const audits = []; let finished = null;
  const baseJob = {id:wid, workspace_id:wid, version:0, busy:false, stage:'code_review',
    data:{connectionVersion:0, artifacts:{hash:'h1', files:[]}, artifactAuthorId:'owner', orgContext:{org:{id:'00D000000000001'}}, approvals:{}}};
  global.fetch = async (url, opts = {}) => {
    const u = String(url), body = opts.body ? JSON.parse(opts.body) : null;
    if (u.includes('/auth/v1/user')) return Response.json({id:'owner', email:'owner@test.example'});
    if (u.includes('/members?')) return Response.json([{role:'owner'}]);
    if (u.includes('/workspaces?')) return Response.json([{id:wid, connection_version:0, sod_mode:'warn'}]);
    if (u.includes('/rpc/claim_job')) return Response.json([{...baseJob, busy:true, version:1}]);
    if (u.includes('/rpc/finish_job')) { finished = {stage:body.p_stage, data:body.p_data}; return Response.json([{...baseJob, busy:false, version:2, stage:body.p_stage, data:body.p_data}]); }
    if (u.includes('/audit_events')) { audits.push(body); return Response.json([]); }
    if (u.includes('/jobs?')) return Response.json([baseJob]);
    throw new Error('Unexpected endpoint: ' + u);
  };
  const headers = {origin:process.env.APP_ORIGIN, cookie:'sfda_session=' + seal({access_token:'test', expires:Date.now()+600000}, 'session')};
  try {
    const r = await hrequest('approveCode', {workspaceId:wid, jobId:wid}, headers);
    assert.equal(r.status, 200);
    assert.equal(finished.data.approvals.code.selfApproved, true);
    assert.ok(audits.some(a => a.action === 'sod.self_approval'), 'a self-approval audit event is recorded');
  } finally { global.fetch = old; }
});
