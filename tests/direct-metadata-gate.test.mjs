import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDirectMetadataDrift,requireNoDirectDrift} from '../lib/direct-metadata-gate.mjs';

const inventory=(name='Account')=>({
 objects:[{name,label:name,custom:false}],
 schemas:[{name,status:'observed',fields:[{name:'Name',type:'string',required:true,referenceTo:[]}],availableFields:1,returnedFields:1}],
 apexClasses:[],
 metadataInventory:{version:1,limits:{objects:400,schemas:8,fieldsPerObject:120,apexClasses:200},
  evidence:{objects:{status:'observed',available:1,returned:1},
   selection:{status:'observed',matched:1,selected:[name],omitted:[]},
   apex:{status:'observed',returned:0}},
  notRetrieved:['Apex source','Flow definitions','permission sets','sharing rules','metadata dependencies']}
});
const approved=()=>({org:{id:'00DTEST'},...inventory()});
const request=async path=>{
 if(path==='/sobjects')return {sobjects:[{name:'Account',label:'Account',custom:false}]};
 if(path==='/sobjects/Account/describe')return {fields:[{name:'Name',type:'string',nillable:false,referenceTo:[]}]};
 if(path.startsWith('/tooling/query'))return {records:[],done:true};
 throw Error('unexpected request');
};
test('current Salesforce metadata permits direct sandbox validation only when matching',async()=>{
 const result=await verifyDirectMetadataDrift(approved(),'Account',request,'00DTEST');
 assert.equal(result.blocking,false);
 assert.equal(requireNoDirectDrift(result),result);
});
test('changed field evidence blocks direct Salesforce operations',async()=>{
 const changed=async path=>path==='/sobjects/Account/describe'
  ? {fields:[{name:'Name',type:'textarea',nillable:false,referenceTo:[]}]}
  : request(path);
 const result=await verifyDirectMetadataDrift(approved(),'Account',changed,'00DTEST');
 assert.equal(result.blocking,true);
 assert.throws(()=>requireNoDirectDrift(result),error=>error.status===409);
});
test('inaccessible Apex evidence blocks even when other values agree',async()=>{
 const inaccessible=async path=>path.startsWith('/tooling/query')?Promise.reject(Error('no access')):request(path);
 const result=await verifyDirectMetadataDrift(approved(),'Account',inaccessible,'00DTEST');
 assert.equal(result.blocking,true);
 assert.ok(result.unverifiable.includes('current.apexClasses'));
});
test('org mismatch fails before any remote request',async()=>{
 let called=false;
 await assert.rejects(()=>verifyDirectMetadataDrift(approved(),'Account',async()=>{called=true;},'00DOTHER'),error=>error.status===409);
 assert.equal(called,false);
});
