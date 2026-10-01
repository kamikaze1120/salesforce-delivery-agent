import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {cleanConfig,publicConfig,origin,seal,unseal,artifactsSchema,sourceFormat,requireApproval,zip,crc32,planSchema} from '../lib/core.mjs';
process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
const sampleFiles=[{path:'classes/Priority.cls',content:'public with sharing class Priority {}'},{path:'classes/Priority.cls-meta.xml',content:'<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>65.0</apiVersion><status>Active</status></ApexClass>'}];
test('service origins reject SSRF destinations, credentials, query strings, and lookalike hosts',()=>{
  for(const value of ['http://localhost','https://127.0.0.1','https://team.atlassian.net.evil.test','https://a:b@team.atlassian.net','https://team.atlassian.net/path','https://team.atlassian.net?x=y','https://team.atlassian.net:8443'])assert.throws(()=>origin(value,'Jira'));
  assert.equal(origin('https://team.atlassian.net/','Jira'),'https://team.atlassian.net');
  assert.equal(origin('https://team--dev.sandbox.my.salesforce.com','Salesforce'),'https://team--dev.sandbox.my.salesforce.com');
});
test('credential encryption is bound to its tenant, connection type, and integrity tag',()=>{
  const encrypted=seal({token:'never-visible'},'workspace-one:github');
  assert.equal(unseal(encrypted,'workspace-one:github').token,'never-visible');
  assert.throws(()=>unseal(encrypted,'workspace-two:github'));
  const bytes=Buffer.from(encrypted,'base64url');bytes[30]^=1;assert.throws(()=>unseal(bytes.toString('base64url'),'workspace-one:github'));
});
test('connection responses omit all credential fields',()=>{
  const out=publicConfig('salesforce',{url:'https://example.my.salesforce.com',token:'x',clientSecret:'x',accessToken:'x',refreshToken:'x'});
  assert.deepEqual(Object.keys(out),['url']);
});
test('project configuration validates source paths and Jira keys',()=>{
  assert.throws(()=>cleanConfig('github',{url:'https://github.com/team/repo',branch:'main',sourcePath:'../secret',token:'x'}));
  assert.throws(()=>cleanConfig('jira',{url:'https://team.atlassian.net',projectKey:'FOO" OR 1=1',email:'a@b.test',issueTypeId:'10001',token:'x'}));
});
test('metadata manifest is server-built and rejects traversal, arbitrary files, and duplicate paths',()=>{
  for(const path of ['../../server.js','scripts/deploy.sh','.env','package.xml','classes/Priority.cls/evil'])assert.throws(()=>artifactsSchema({files:[{path,content:'x'}]}));
  assert.throws(()=>artifactsSchema({files:[...sampleFiles,sampleFiles[0]]}));
  assert.throws(()=>artifactsSchema({files:[sampleFiles[0]]}));
  const release=artifactsSchema({files:sampleFiles});
  assert.match(release.files.find(f=>f.path==='package.xml').content,/<name>ApexClass<\/name>/);
  assert.equal(release.hash.length,64);
});
test('changed artifacts or accounts invalidate approval',()=>{
  const job={data:{artifacts:{hash:'a'},connectionVersion:3,approvals:{code:{hash:'a',connectionVersion:3}}}};
  assert.doesNotThrow(()=>requireApproval(job,'code'));
  job.data.artifacts.hash='b';assert.throws(()=>requireApproval(job,'code'));
  job.data.artifacts.hash='a';job.data.connectionVersion=4;assert.throws(()=>requireApproval(job,'code'));
});
test('generated flows cannot be activated and permission sets cannot grant org administration',()=>{
  assert.throws(()=>artifactsSchema({files:[{path:'flows/DueDate.flow',content:'<Flow><status>Active</status></Flow>'}]}),/must remain Draft/);
  assert.throws(()=>artifactsSchema({files:[{path:'permissionsets/Request.permissionset',content:'<PermissionSet><userPermissions><enabled>true</enabled><name>ModifyAllData</name></userPermissions></PermissionSet>'}]}),/administration/);
});
test('object decomposition produces source-format children and preserves the parent',()=>{
  const file={path:'objects/Request__c.object',content:'<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>Request</label><fields><fullName>Priority__c</fullName><label>Priority</label><type>Text</type><length>30</length></fields><nameField><label>Request Number</label><type>AutoNumber</type><displayFormat>REQ-{0000}</displayFormat></nameField><sharingModel>Private</sharingModel></CustomObject>'};
  const out=sourceFormat([file],'force-app/main/default');
  assert.equal(out.length,2);assert.match(out[0].path,/Priority__c.field-meta.xml$/);assert.match(out[0].content,/<CustomField /);assert.doesNotMatch(out[1].content,/<fields>/);assert.match(out[1].content,/<nameField>/);
  assert.throws(()=>sourceFormat([{...file,content:'<!DOCTYPE evil SYSTEM "https://evil.test"><CustomObject></CustomObject>'}],'force-app'));
});
test('ZIP output has a valid directory and known CRC checksum',()=>{
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
  const output=zip([{path:'package.xml',content:'hello'}]);
  assert.equal(output.readUInt32LE(0),0x04034b50);assert.equal(output.readUInt32LE(output.length-22),0x06054b50);assert.equal(output.readUInt16LE(output.length-12),1);
});
test('plan schema rejects untraceable stories and uncovered requirements',()=>{
  const input={summary:'Plan',solution:'Solution',testPlan:['Verify saving a record'],requirements:[{title:'One',source:'Original BRD',acceptance:['User can save']}],stories:[{title:'Task',description:'Build it',requirements:['REQ-99'],acceptance:['User can save']}]};
  assert.throws(()=>planSchema(input));input.stories[0].requirements=['REQ-1'];assert.equal(planSchema(input).requirements[0].id,'REQ-1');
});
