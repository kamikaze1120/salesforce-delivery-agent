import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedBrowserOrigins,browserNetworkPolicy} from '../lib/browser-policy.mjs';
test('browser requests use exact reviewed origins and block credentials, redirects and deceptive domains',()=>{
 const p=browserNetworkPolicy({url:'https://team.my.salesforce.com',browserOrigins:['https://static.sfdcstatic.com']});
 for(const u of ['https://team.my.salesforce.com/path','https://team.lightning.force.com/path','https://static.sfdcstatic.com/file'])assert.equal(p.allows(u),true);
 for(const u of ['https://other.my.salesforce.com/path?secret=token','https://team.my.salesforce.com.evil.test/','http://team.my.salesforce.com','https://user:secret@team.my.salesforce.com','https://team.my.salesforce.com:8443/'])assert.equal(p.allows(u),false);
 const e=p.evidence();assert.equal(e.status,'blocked');assert.ok(!JSON.stringify(e).includes('secret'));assert.ok(!JSON.stringify(e).includes('other.my'));
});
test('configuration rejects wildcards, arbitrary origins and unbounded entries',()=>{
 for(const value of [['https://evil.test'],['https://*.force.com'],['https://team.force.com/path'],['https://user:secret@team.force.com'],Array(11).fill('https://a.force.com')])assert.throws(()=>reviewedBrowserOrigins(value));
});
