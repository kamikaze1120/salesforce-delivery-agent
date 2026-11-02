import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactReview} from '../lib/review.mjs';
const review=files=>artifactReview({files});
const byPath=(files,path)=>review(files).find(r=>r.path===path);

test('package.xml is excluded from the review summary',()=>{
  const out=review([{path:'package.xml',content:'<Package/>'},{path:'classes/A.cls',content:'public with sharing class A {}'},{path:'classes/A.cls-meta.xml',content:'<ApexClass/>'}]);
  assert.ok(!out.find(r=>r.path==='package.xml'));
});

test('an Apex class reports its sharing mode and method count',()=>{
  const r=byPath([{path:'classes/Priority.cls',content:'public with sharing class Priority {\n public void run(){}\n private Integer calc(Integer x){ return x; }\n}'},{path:'classes/Priority.cls-meta.xml',content:'<ApexClass/>'}],'classes/Priority.cls');
  assert.equal(r.kind,'Apex class');
  assert.match(r.highlights.join(' '),/with sharing/);
  assert.match(r.highlights.join(' '),/2 method/);
});

test('an Apex class metadata companion is folded into its class, not listed separately',()=>{
  const out=review([{path:'classes/Priority.cls',content:'public class Priority {}'},{path:'classes/Priority.cls-meta.xml',content:'<ApexClass/>'}]);
  assert.equal(out.filter(r=>r.path.startsWith('classes/')).length,1);
});

test('a custom object reports its field and validation-rule counts',()=>{
  const content='<?xml version="1.0"?><CustomObject><label>Invoice</label><fields><fullName>A__c</fullName></fields><fields><fullName>B__c</fullName></fields><validationRules><fullName>R1</fullName></validationRules></CustomObject>';
  const r=byPath([{path:'objects/Invoice__c.object',content}],'objects/Invoice__c.object');
  assert.equal(r.kind,'Custom object');
  assert.match(r.highlights.join(' '),/2 field/);
  assert.match(r.highlights.join(' '),/1 validation rule/);
});

test('a Flow reports its activation status',()=>{
  const r=byPath([{path:'flows/DueDate.flow',content:'<Flow><status>Draft</status></Flow>'}],'flows/DueDate.flow');
  assert.equal(r.kind,'Flow');
  assert.match(r.highlights.join(' '),/Draft/);
});

test('a permission set reports how many permissions it enables',()=>{
  const content='<PermissionSet><userPermissions><enabled>true</enabled><name>ApiEnabled</name></userPermissions><objectPermissions><object>Invoice__c</object></objectPermissions></PermissionSet>';
  const r=byPath([{path:'permissionsets/Billing.permissionset',content}],'permissionsets/Billing.permissionset');
  assert.equal(r.kind,'Permission set');
  assert.match(r.highlights.join(' '),/1 user permission/);
  assert.match(r.highlights.join(' '),/1 object/);
});

test('a Lightning app reports its label and tab count',()=>{
  const content='<CustomApplication><label>Delivery Console</label><uiType>Lightning</uiType><tabs>Invoice__c</tabs><tabs>Payment__c</tabs></CustomApplication>';
  const r=byPath([{path:'applications/Delivery_Console.app',content}],'applications/Delivery_Console.app');
  assert.equal(r.kind,'Lightning app');
  assert.match(r.highlights.join(' '),/Delivery Console/);
  assert.match(r.highlights.join(' '),/2 tab/);
});

test('a custom object tab is identified',()=>{
  const r=byPath([{path:'tabs/Invoice__c.tab',content:'<CustomTab><customObject>true</customObject></CustomTab>'}],'tabs/Invoice__c.tab');
  assert.equal(r.kind,'Custom tab');
});

test('an Apex trigger reports its object and events',()=>{
  const r=byPath([{path:'triggers/InvoiceTrigger.trigger',content:'trigger InvoiceTrigger on Invoice__c (before insert, after update) {}'},{path:'triggers/InvoiceTrigger.trigger-meta.xml',content:'<ApexTrigger/>'}],'triggers/InvoiceTrigger.trigger');
  assert.equal(r.kind,'Apex trigger');
  assert.match(r.highlights.join(' '),/Invoice__c/);
  assert.match(r.highlights.join(' '),/before insert/);
});

test('every summary row carries a byte size',()=>{
  const r=byPath([{path:'classes/A.cls',content:'public class A {}'},{path:'classes/A.cls-meta.xml',content:'<ApexClass/>'}],'classes/A.cls');
  assert.equal(typeof r.bytes,'number');
  assert.ok(r.bytes>0);
});
