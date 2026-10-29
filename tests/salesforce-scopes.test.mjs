import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedSalesforceScopes,salesforceScopeEvidence,requireSalesforceScope} from '../lib/salesforce-scopes.mjs';

test('implemented core OAuth profile is allowlisted and least privilege',()=>{
 assert.deepEqual(requestedSalesforceScopes(),['api','refresh_token']);
 for(const profile of ['mcp_api','einstein_gpt_api','web','all','',{}])assert.throws(()=>requestedSalesforceScopes(profile),error=>error.status===409);
});
test('grants and requests are tracked separately',()=>{
 const requested=requestedSalesforceScopes();
 const evidence=salesforceScopeEvidence(requested,'refresh_token api id');
 assert.equal(evidence.status,'observed');
 assert.deepEqual(evidence.requested,['api','refresh_token']);
 assert.deepEqual(evidence.granted,['api','id','refresh_token']);
 assert.equal(requireSalesforceScope(evidence,'api'),undefined);
});
test('absent response scope stays explicitly unknown and never passes required grant',()=>{
 const evidence=salesforceScopeEvidence(requestedSalesforceScopes(),undefined);
 assert.equal(evidence.status,'unknown');
 assert.deepEqual(evidence.granted,[]);
 assert.throws(()=>requireSalesforceScope(evidence,'api'),error=>error.status===409);
});
test('a partial or malformed grant cannot be presented as verified',()=>{
 const missing=salesforceScopeEvidence(requestedSalesforceScopes(),'api');
 assert.equal(missing.status,'insufficient');
 assert.deepEqual(missing.missing,['refresh_token']);
 assert.throws(()=>requireSalesforceScope(missing,'api'),error=>error.status===409);
 assert.throws(()=>salesforceScopeEvidence(requestedSalesforceScopes(),'api *'),error=>error.status===502);
});
