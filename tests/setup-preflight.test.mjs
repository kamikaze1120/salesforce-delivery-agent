import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPreflight} from '../lib/setup-preflight.mjs';
const deps={getConnection:async()=>({config:{token:'SECRET'}}),query:async()=>1,checkSalesforce:async()=>{},checkJira:async()=>{},checkModel:async()=>{},checkPipeline:async()=>{}};
test('preflight reports only observed checks as passed and leaves runner credentials unknown',async()=>{
 const r=await setupPreflight({id:'w',connection_version:2},deps);assert.equal(r.checks.filter(c=>c.status==='passed').length,5);assert.equal(r.status,'unknown');assert.equal(r.connectionVersion,2);assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('missing migrations and connector errors produce bounded remediation without echoing secrets',async()=>{
 const r=await setupPreflight({id:'w',connection_version:3},{...deps,query:async()=>0,checkJira:async()=>{throw Error('SECRET token in provider response');}});assert.equal(r.status,'failed');assert.equal(r.checks.find(c=>c.id==='jira').status,'failed');assert.ok(!JSON.stringify(r).includes('SECRET'));
});
