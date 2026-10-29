import test from 'node:test';
import assert from 'node:assert/strict';
import {metadataInventory} from '../lib/metadata-inventory.mjs';

test('inventory exposes all enforced limits including done=true Apex LIMIT truncation',async()=>{
 let calls=0;
 const result=await metadataInventory(async path=>{
  calls++;
  if(path==='/sobjects')return {sobjects:Array.from({length:401},(_,i)=>({name:'Thing'+i,label:'Thing',custom:true,secret:'omit'}))};
  if(path.includes('/describe'))return {fields:Array.from({length:121},(_,i)=>({name:'F'+i,type:'string',nillable:true,referenceTo:[],defaultValue:'sensitive'}))};
  if(decodeURIComponent(path).includes('FROM PermissionSet'))return {done:true,records:[]};
  if(decodeURIComponent(path).includes('FROM FlowDefinition'))return {done:true,records:[]};
  if(decodeURIComponent(path).includes('LIMIT 21'))return {done:true,records:Array.from({length:21},(_,i)=>({Name:'Local'+i,Body:'private source '+i}))};
  assert.match(decodeURIComponent(path),/LIMIT 201$/);
  return {done:true,records:Array.from({length:201},(_,i)=>({Name:'Test'+i,Body:'secret'}))};
 },'Thing');
 assert.equal(calls,13);
 assert.equal(result.objects.length,400);
 assert.equal(result.schemas.length,8);
 assert.equal(result.schemas[0].fields.length,120);
 assert.equal(result.metadataInventory.evidence.apex.status,'partial');
 assert.equal(result.metadataInventory.evidence.apexSourceHashes.status,'partial');
 assert.equal(result.apexSourceHashes.length,20);
 assert.ok(result.apexSourceHashes.every(s=>/^[a-f0-9]{64}$/.test(s.hash)));
 assert.equal(result.metadataInventory.evidence.selection.omitted.length,393);
 assert.equal(result.schemas[0].status,'partial');
 assert.equal(result.metadataInventory.status,'partial');
 assert.ok(!JSON.stringify(result).includes('secret'));
 assert.ok(!JSON.stringify(result).includes('sensitive'));
});

test('access failures and malformed metadata remain unknown without exposing error bodies',async()=>{
 const result=await metadataInventory(async path=>{
  if(path==='/sobjects')return {sobjects:[{name:'Account',label:'Account'}]};
  throw Error('secret token and customer records');
 },'Account');
 assert.equal(result.schemas[0].status,'unknown');
 assert.equal(result.metadataInventory.evidence.apex.status,'unknown');
 assert.ok(!JSON.stringify(result).includes('secret'));
 const malformed=await metadataInventory(async()=>({}),'Account');
 assert.equal(malformed.metadataInventory.evidence.objects.status,'unknown');
 assert.equal(malformed.metadataInventory.evidence.selection.status,'unknown');
});

test('baseline hashes are stable and change when observed field definitions change',async()=>{
 let type='string';
 const read=async path=>path==='/sobjects'
  ? {sobjects:[{name:'Account',label:'Account'}]}
  : path.includes('/describe')
   ? {fields:[{name:'Name',type,nillable:false}]}
   : {records:[],done:true};
 const a=await metadataInventory(read,'Account');
 const b=await metadataInventory(read,'Account');
 assert.equal(a.metadataInventory.hash,b.metadataInventory.hash);
 type='boolean';
 const c=await metadataInventory(read,'Account');
 assert.notEqual(a.metadataInventory.hash,c.metadataInventory.hash);
});


test('Apex source fingerprints remain redacted and stable while source changes are detected',async()=>{
 let body='class Safe {}';
 const request=async path=>{
  if(path==='/sobjects')return {sobjects:[]};
  if(decodeURIComponent(path).includes('LIMIT 21'))return {done:true,records:[{Name:'Safe',Body:body}]};
  return {done:true,records:[]};
 };
 const before=await metadataInventory(request,'Safe');
 assert.equal(before.metadataInventory.evidence.apexSourceHashes.status,'observed');
 assert.equal(before.apexSourceHashes.length,1);
 assert.ok(!JSON.stringify(before).includes('class Safe'));
 body='class Safe { public static void run() {} }';
 const after=await metadataInventory(request,'Safe');
 assert.notEqual(before.apexSourceHashes[0].hash,after.apexSourceHashes[0].hash);
 assert.ok(!JSON.stringify(after).includes('public static'));
});


test('Flow identity observations are capped and redact provider records',async()=>{
 const result=await metadataInventory(async path=>{
  if(path==='/sobjects')return {sobjects:[]};
  if(decodeURIComponent(path).includes('FROM FlowDefinition'))return {done:true,records:[{DeveloperName:'Intake',ActiveVersionId:null,Extra:'private text'}]};
  return {done:true,records:[]};
 },'Flow Intake');
 assert.deepEqual(result.flowDefinitions,[{name:'Intake',activeVersionId:null}]);
 assert.equal(result.metadataInventory.evidence.flows.status,'observed');
 assert.ok(!JSON.stringify(result).includes('private text'));
});


test('permission-set observations are redacted identity records',async()=>{
 const result=await metadataInventory(async path=>{
  if(path==='/sobjects')return {sobjects:[]};
  if(decodeURIComponent(path).includes('FROM PermissionSet'))return {done:true,records:[{Name:'Case_Access',IsOwnedByProfile:false,PermissionsModifyAllData:true,Secret:'do not reveal'}]};
  return {done:true,records:[]};
 },'Case Access');
 assert.deepEqual(result.permissionSets,[{name:'Case_Access'}]);
 assert.equal(result.metadataInventory.evidence.permissionSets.status,'observed');
 assert.ok(!JSON.stringify(result).includes('do not reveal'));
});
