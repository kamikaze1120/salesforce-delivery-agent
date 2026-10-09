import test from 'node:test';
import assert from 'node:assert/strict';
import {scanCapabilities} from '../lib/capabilities.mjs';
const org={id:'00D000000000001',organizationType:'Developer Edition',environment:'developer'};
test('denied license probes remain unknown, not unlicensed',async()=>{
 const report=await scanCapabilities(async()=>{throw Error('denied secret');},org);
 assert.equal(report.edition,'Developer Edition');
 assert.ok(Object.values(report.evidence).every(e=>e.status==='unknown'));
 assert.ok(!JSON.stringify(report).includes('denied secret'));
 assert.match(report.deployment,/unknown/);
});
test('license fields are discovered and a partial inventory is labelled',async()=>{
 const queries=[];
 const report=await scanCapabilities(async path=>{
  if(path.endsWith('/describe'))return {fields:[{name:'Name'}]};
  if(path.startsWith('/query')){queries.push(decodeURIComponent(path));return {records:[{Name:'Salesforce',attributes:{secret:'x'}}],done:false};}
  if(path==='/limits')return {DailyApiRequests:{Max:100,Remaining:0}};
  return {sobjects:[{name:'Account',createable:false,queryable:true}]};
 },org);
 assert.deepEqual(report.evidence.userLicenses.value.fields,['Name']);
 assert.equal(report.evidence.userLicenses.value.truncated,true);
 assert.equal(report.evidence.connectedUser.status,'unknown');
 assert.equal(report.evidence.objects.value.records[0].createable,false);
 assert.ok(queries.every(q=>!q.includes('TotalLicenses')));
 assert.ok(!JSON.stringify(report).includes('secret'));
});
