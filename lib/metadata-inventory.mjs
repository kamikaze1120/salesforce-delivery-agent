import {hash} from './core.mjs';

// Metadata only: never query business records or retain provider exception bodies.
export async function metadataInventory(request,brd){
 const limits={objects:400,schemas:8,fieldsPerObject:120,apexClasses:200},evidence={},schemas=[];
 let objects=[],apexClasses=[],apexSourceHashes=[];
 const unknown=()=>({status:'unknown',reason:'Metadata is inaccessible or malformed; administrator verification is required.'});
 try{
  const result=await request('/sobjects');
  if(!Array.isArray(result.sobjects))throw Error();
  objects=result.sobjects.map(o=>{
   if(typeof o.name!=='string'||typeof o.label!=='string')throw Error();
   return {name:o.name,label:o.label,custom:o.custom===true};
  });
  evidence.objects={status:objects.length>limits.objects?'partial':'observed',available:objects.length,returned:Math.min(objects.length,limits.objects)};
 }catch{evidence.objects=unknown();}
 const text=String(brd).toLowerCase(),matched=objects.filter(o=>text.includes(o.name.toLowerCase())||(o.label&&text.includes(o.label.toLowerCase())));
 const wanted=matched.slice(0,limits.schemas);
 evidence.selection={method:'BRD name/label matching; not dependency discovery',matched:matched.length,selected:wanted.map(o=>o.name),omitted:matched.slice(limits.schemas).map(o=>o.name),status:evidence.objects.status==='unknown'?'unknown':matched.length>limits.schemas?'partial':matched.length?'observed':'unknown'};
 for(const o of wanted){
  try{
   const d=await request(`/sobjects/${encodeURIComponent(o.name)}/describe`);
   if(!Array.isArray(d.fields))throw Error();
   const fields=d.fields.slice(0,limits.fieldsPerObject).map(f=>{
    if(typeof f.name!=='string'||typeof f.type!=='string'||typeof f.nillable!=='boolean')throw Error();
    return {name:f.name,type:f.type,required:!f.nillable,referenceTo:Array.isArray(f.referenceTo)?f.referenceTo.filter(x=>typeof x==='string'):[]};
   });
   schemas.push({name:o.name,fields,status:d.fields.length>limits.fieldsPerObject?'partial':'observed',availableFields:d.fields.length,returnedFields:fields.length,hash:hash(fields)});
  }catch{schemas.push({name:o.name,fields:[],...unknown()});}
 }
 try{
  // One extra row reveals a LIMIT-truncated result even when Salesforce reports done=true.
  const r=await request('/tooling/query?q='+encodeURIComponent('SELECT Name, NamespacePrefix FROM ApexClass LIMIT 201'));
  if(!Array.isArray(r.records))throw Error();
  apexClasses=r.records.slice(0,limits.apexClasses).map(r=>{
   if(typeof r.Name!=='string')throw Error();
   return {name:r.Name,namespace:typeof r.NamespacePrefix==='string'?r.NamespacePrefix:null};
  });
  evidence.apex={status:r.done!==true||r.records.length>limits.apexClasses?'partial':'observed',returned:apexClasses.length,scope:'Names only; source bodies are not retrieved.'};
 }catch{evidence.apex=unknown();}
 // Hash a small deterministic sample of local Apex bodies in process. Neither
 // business data nor source content is returned, persisted, or sent to the LLM.
 // This is only evidence of sampled bodies, not complete source retrieval.
 try {
  const maxSourceHashes=20;
  const result=await request('/tooling/query?q='+encodeURIComponent('SELECT Name, Body FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name LIMIT 21'));
  if(!Array.isArray(result.records))throw Error();
  const sample=result.records.slice(0,maxSourceHashes);
  apexSourceHashes=sample.map(row=>{
   if(typeof row.Name!=='string'||!/^[A-Za-z][A-Za-z0-9_]*$/.test(row.Name)||typeof row.Body!=='string')throw Error();
   return {name:row.Name,hash:hash(row.Body)};
  });
  evidence.apexSourceHashes={status:result.done!==true||result.records.length>maxSourceHashes?'partial':'observed',returned:apexSourceHashes.length,limit:maxSourceHashes,scope:'Local Apex bodies, SHA-256 hashes only; no source returned'};
 } catch {apexSourceHashes=[];evidence.apexSourceHashes=unknown();}
 const baseline={objects:objects.slice(0,limits.objects),schemas,apexClasses,apexSourceHashes};
 return {...baseline,metadataInventory:{version:1,checkedAt:new Date().toISOString(),hash:hash(baseline),status:'partial',limits,evidence,notRetrieved:['Complete Apex source','Flow definitions','permission sets','sharing rules','metadata dependencies'],guidance:'This is a partial inventory, not a deployable baseline. Unknown or omitted metadata is not evidence of absence. Resolve affected dependencies before architecture approval.'},scope:'Bounded object/field descriptions and Apex names only. Full source and dependencies remain unverified.'};
}
