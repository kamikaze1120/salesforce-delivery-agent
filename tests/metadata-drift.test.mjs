import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalMetadataBaseline,compareMetadataBaselines,metadataBaselineFingerprint} from '../lib/metadata-drift.mjs';

function baseline(){
 return {
  objects:[
   {name:'Invoice__c',label:'Invoice',custom:true},
   {name:'Account',label:'Account',custom:false}
  ],
  schemas:[{
   name:'Account',status:'observed',availableFields:2,returnedFields:2,
   fields:[
    {name:'OwnerId',type:'reference',required:false,referenceTo:['User','Group']},
    {name:'Name',type:'string',required:true,referenceTo:[]}
   ]
  }],
  apexClasses:[
   {name:'Handler',namespace:'pkg'},
   {name:'Handler',namespace:null}
  ],
  metadataInventory:{
   version:1,
   checkedAt:'2026-10-29T14:00:00.000Z',
   hash:'provider-hash-is-not-trusted-for-drift',
   status:'partial',
   limits:{objects:400,schemas:8,fieldsPerObject:120,apexClasses:200},
   evidence:{
    objects:{status:'observed',available:2,returned:2},
    selection:{status:'observed',matched:1,selected:['Account'],omitted:[]},
    apex:{status:'observed',returned:2}
   },
   notRetrieved:['sharing rules','Flow definitions','Apex source']
  }
 };
}

function clone(value){return structuredClone(value);}

test('semantic ordering and observation timestamps do not create metadata drift',()=>{
 const approved=baseline(),current=clone(approved);
 current.objects.reverse();
 current.schemas[0].fields.reverse();
 current.schemas[0].fields.find(field=>field.name==='OwnerId').referenceTo.reverse();
 current.apexClasses.reverse();
 current.metadataInventory.checkedAt='2026-10-29T15:00:00.000Z';
 current.metadataInventory.hash='different-provider-hash';
 current.metadataInventory.limits={apexClasses:200,fieldsPerObject:120,schemas:8,objects:400};
 current.metadataInventory.notRetrieved.reverse();
 assert.equal(metadataBaselineFingerprint(approved),metadataBaselineFingerprint(current));
 const result=compareMetadataBaselines(approved,current);
 assert.equal(result.blocking,false);
 assert.equal(result.totalDifferences,0);
 assert.deepEqual(result.unverifiable,[]);
});

test('a field definition change produces a readable blocking schema difference',()=>{
 const approved=baseline(),current=clone(approved);
 current.schemas[0].fields.find(field=>field.name==='Name').type='textarea';
 const result=compareMetadataBaselines(approved,current);
 assert.equal(result.blocking,true);
 assert.notEqual(result.approvedHash,result.currentHash);
 assert.ok(result.differences.some(item=>item.path==='schemas.Account'&&item.kind==='changed'));
 assert.match(result.message,/changed or could not be verified/i);
});

test('object and namespaced Apex additions remain distinct in drift evidence',()=>{
 const approved=baseline(),current=clone(approved);
 current.objects.push({name:'Contact',label:'Contact',custom:false});
 current.apexClasses.push({name:'Handler',namespace:'other'});
 current.metadataInventory.evidence.objects.available=3;
 current.metadataInventory.evidence.objects.returned=3;
 current.metadataInventory.evidence.apex.returned=3;
 const result=compareMetadataBaselines(approved,current);
 assert.equal(result.blocking,true);
 assert.ok(result.differences.some(item=>item.path==='objects.Contact'&&item.kind==='added'));
 assert.ok(result.differences.some(item=>item.path==='apexClasses.other:Handler'&&item.kind==='added'));
});

test('unknown current access blocks even when the visible rows are unchanged',()=>{
 const approved=baseline(),current=clone(approved);
 current.metadataInventory.evidence.apex.status='unknown';
 current.schemas[0].status='unknown';
 const result=compareMetadataBaselines(approved,current);
 assert.equal(result.blocking,true);
 assert.ok(result.unverifiable.includes('current.apexClasses'));
 assert.ok(result.unverifiable.includes('current.schemas.Account'));
});

test('difference output is bounded while preserving the total count',()=>{
 const approved=baseline(),current=clone(approved);
 for(let index=0;index<6;index++)current.objects.push({name:`Extra${index}__c`,label:`Extra ${index}`,custom:true});
 current.metadataInventory.evidence.objects.available=8;
 current.metadataInventory.evidence.objects.returned=8;
 const result=compareMetadataBaselines(approved,current,{maxDifferences:2});
 assert.equal(result.blocking,true);
 assert.equal(result.differences.length,2);
 assert.ok(result.totalDifferences>2);
 assert.equal(result.truncated,result.totalDifferences-2);
});

test('malformed or duplicate baseline evidence fails closed',()=>{
 const duplicate=baseline();
 duplicate.apexClasses.push({name:'Handler',namespace:'pkg'});
 assert.throws(()=>canonicalMetadataBaseline(duplicate),error=>error?.status===409&&/Duplicate Apex class evidence/.test(error.message));
 const unsupported=baseline();
 unsupported.metadataInventory.version=2;
 assert.throws(()=>metadataBaselineFingerprint(unsupported),error=>error?.status===409&&/supported Salesforce metadata baseline/.test(error.message));
});


test('partial observations and missing BRD selection block even with identical rows',()=>{
 const partial=baseline();
 partial.metadataInventory.evidence.objects.status='partial';
 const result=compareMetadataBaselines(partial,structuredClone(partial));
 assert.equal(result.blocking,true);
 assert.ok(result.unverifiable.includes('current.objects'));
 const unselected=baseline();
 unselected.metadataInventory.evidence.selection.status='unknown';
 unselected.metadataInventory.evidence.selection.selected=[];
 assert.equal(compareMetadataBaselines(unselected,structuredClone(unselected)).blocking,true);
});


test('observed Apex body hash changes block direct metadata drift and never reveal source',()=>{
 const approved=baseline(),current=structuredClone(approved);
 approved.apexSourceHashes=[{name:'Handler',hash:'a'.repeat(64)}];
 current.apexSourceHashes=[{name:'Handler',hash:'b'.repeat(64)}];
 approved.metadataInventory.evidence.apexSourceHashes={status:'observed',returned:1};
 current.metadataInventory.evidence.apexSourceHashes={status:'observed',returned:1};
 const result=compareMetadataBaselines(approved,current);
 assert.equal(result.blocking,true);
 assert.ok(result.differences.some(d=>d.path==='apexSourceHashes.Handler'));
 assert.ok(!JSON.stringify(result).includes('class Handler'));
});

test('unknown sampled Apex source blocks even if observed objects agree',()=>{
 const approved=baseline(),current=structuredClone(approved);
 approved.metadataInventory.evidence.apexSourceHashes={status:'unknown'};
 current.metadataInventory.evidence.apexSourceHashes={status:'unknown'};
 assert.equal(compareMetadataBaselines(approved,current).blocking,true);
});
