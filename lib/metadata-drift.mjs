import {assert,hash} from './core.mjs';

export const metadataDriftPolicy='bounded-inventory-fail-closed-v1';

function text(value,label){assert(typeof value==='string'&&value.length>0,`Invalid metadata baseline ${label}.`,409);return value;}
function count(value,label){assert(Number.isSafeInteger(value)&&value>=0,`Invalid metadata baseline ${label}.`,409);return value;}
function status(value,label){assert(['observed','partial','unknown'].includes(value),`Invalid metadata baseline ${label}.`,409);return value;}
function strings(value,label){assert(Array.isArray(value)&&value.every(v=>typeof v==='string'),`Invalid metadata baseline ${label}.`,409);return [...new Set(value)].sort();}
function byName(a,b){return a.name.localeCompare(b.name)||JSON.stringify(a).localeCompare(JSON.stringify(b));}
function unique(values,label,key=value=>value.name){const keys=values.map(key);assert(new Set(keys).size===keys.length,`Duplicate ${label} evidence.`,409);return values;}

function canonicalLimits(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value),'The Salesforce metadata limits are missing.',409);
 return {
  objects:count(value.objects,'object limit'),
  schemas:count(value.schemas,'schema limit'),
  fieldsPerObject:count(value.fieldsPerObject,'field limit'),
  apexClasses:count(value.apexClasses,'Apex class limit')
 };
}

function evidence(value,label){
 assert(value&&typeof value==='object'&&!Array.isArray(value),`Invalid metadata baseline ${label}.`,409);
 return {status:status(value.status,`${label} status`),...(['available','returned','matched'].reduce((out,key)=>{
  if(value[key]!==undefined)out[key]=count(value[key],`${label} ${key}`);return out;
 },{}))};
}

function field(value,schemaName){
 assert(value&&typeof value==='object'&&!Array.isArray(value),`Invalid field evidence for ${schemaName}.`,409);
 return {name:text(value.name,`${schemaName} field name`),type:text(value.type,`${schemaName} field type`),required:value.required===true,referenceTo:strings(value.referenceTo||[],`${schemaName}.${value.name} references`)};
}

function schema(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value),`Invalid schema evidence.`,409);
 const name=text(value.name,'schema name'),schemaStatus=status(value.status,`${name} status`);
 assert(Array.isArray(value.fields),`Invalid fields for ${name}.`,409);
 const fields=unique(value.fields.map(v=>field(v,name)),`${name} field`).sort(byName);
 return {name,status:schemaStatus,availableFields:count(value.availableFields??fields.length,`${name} available fields`),returnedFields:count(value.returnedFields??fields.length,`${name} returned fields`),fields};
}

export function canonicalMetadataBaseline(context){
 const inventory=context?.metadataInventory;
 assert(inventory&&inventory.version===1,'A supported Salesforce metadata baseline is required. Reanalyze the BRD against the current org.',409);
 assert(Array.isArray(context.objects)&&Array.isArray(context.schemas)&&Array.isArray(context.apexClasses),'The Salesforce metadata baseline is incomplete. Reanalyze before continuing.',409);
 const observed=inventory.evidence;
 assert(observed&&typeof observed==='object'&&!Array.isArray(observed),'The Salesforce metadata evidence is missing. Reanalyze before continuing.',409);
 const selection=observed.selection;
 assert(selection&&typeof selection==='object'&&!Array.isArray(selection),'The Salesforce metadata selection evidence is missing. Reanalyze before continuing.',409);
 const objects=unique(context.objects.map(value=>{
  assert(value&&typeof value==='object'&&!Array.isArray(value),'Invalid object evidence.',409);
  return {name:text(value.name,'object name'),label:text(value.label,'object label'),custom:value.custom===true};
 }),'object').sort(byName);
 const schemas=unique(context.schemas.map(schema),'schema').sort(byName);
 const apexClasses=unique(context.apexClasses.map(value=>{
  assert(value&&typeof value==='object'&&!Array.isArray(value),'Invalid Apex evidence.',409);
  return {name:text(value.name,'Apex class name'),namespace:typeof value.namespace==='string'?value.namespace:null};
 }),'Apex class',value=>`${value.namespace||''}:${value.name}`).sort(byName);
 return {
  policy:metadataDriftPolicy,
  inventoryVersion:inventory.version,
  limits:canonicalLimits(inventory.limits),
  objects,
  schemas,
  apexClasses,
  evidence:{
   objects:evidence(observed.objects,'object evidence'),
   selection:{...evidence(selection,'selection evidence'),selected:strings(selection.selected||[],'selected objects'),omitted:strings(selection.omitted||[],'omitted objects')},
   apex:evidence(observed.apex,'Apex evidence')
  },
  notRetrieved:strings(inventory.notRetrieved||[],'unretrieved metadata')
 };
}

export function metadataBaselineFingerprint(context){return hash(canonicalMetadataBaseline(context));}

function index(values,key){return new Map(values.map(value=>[key(value),value]));}
function pushSetDifferences(differences,path,before,after){
 const old=new Set(before),next=new Set(after);
 for(const value of before)if(!next.has(value))differences.push({path,kind:'removed',before:value});
 for(const value of after)if(!old.has(value))differences.push({path,kind:'added',after:value});
}
function pushNamedDifferences(differences,path,before,after,key=value=>value.name){
 const old=index(before,key),next=index(after,key);
 for(const [name,value] of old)if(!next.has(name))differences.push({path:`${path}.${name}`,kind:'removed',before:value});
 for(const [name,value] of next)if(!old.has(name))differences.push({path:`${path}.${name}`,kind:'added',after:value});
 for(const [name,value] of old)if(next.has(name)&&JSON.stringify(value)!==JSON.stringify(next.get(name)))differences.push({path:`${path}.${name}`,kind:'changed',before:value,after:next.get(name)});
}
function unverifiable(value,prefix){
 const gaps=[];
 if(value.evidence.objects.status!=='observed')gaps.push(`${prefix}.objects`);
 if(value.evidence.apex.status!=='observed')gaps.push(`${prefix}.apexClasses`);
 for(const item of value.schemas)if(item.status!=='observed')gaps.push(`${prefix}.schemas.${item.name}`);
 if(value.evidence.selection.status!=='observed')gaps.push(`${prefix}.selection`);
 return gaps;
}

export function compareMetadataBaselines(approvedContext,currentContext,{maxDifferences=100}={}){
 assert(Number.isSafeInteger(maxDifferences)&&maxDifferences>=1&&maxDifferences<=500,'Invalid metadata drift difference limit.',409);
 const approved=canonicalMetadataBaseline(approvedContext),current=canonicalMetadataBaseline(currentContext);
 const approvedHash=hash(approved),currentHash=hash(current),differences=[];
 pushNamedDifferences(differences,'objects',approved.objects,current.objects);
 pushNamedDifferences(differences,'schemas',approved.schemas,current.schemas);
 pushNamedDifferences(differences,'apexClasses',approved.apexClasses,current.apexClasses,value=>`${value.namespace||''}:${value.name}`);
 pushSetDifferences(differences,'selection.selected',approved.evidence.selection.selected,current.evidence.selection.selected);
 pushSetDifferences(differences,'selection.omitted',approved.evidence.selection.omitted,current.evidence.selection.omitted);
 pushSetDifferences(differences,'notRetrieved',approved.notRetrieved,current.notRetrieved);
 for(const key of ['objects','selection','apex'])if(JSON.stringify(approved.evidence[key])!==JSON.stringify(current.evidence[key]))differences.push({path:`evidence.${key}`,kind:'changed',before:approved.evidence[key],after:current.evidence[key]});
 if(JSON.stringify(approved.limits)!==JSON.stringify(current.limits))differences.push({path:'limits',kind:'changed',before:approved.limits,after:current.limits});
 if(approvedHash!==currentHash&&!differences.length)differences.push({path:'metadataInventory',kind:'changed'});
 const gaps=[...unverifiable(approved,'approved'),...unverifiable(current,'current')];
 const totalDifferences=differences.length;
 return {
  policy:metadataDriftPolicy,
  approvedHash,
  currentHash,
  blocking:approvedHash!==currentHash||gaps.length>0,
  differences:differences.slice(0,maxDifferences),
  totalDifferences,
  truncated:Math.max(0,totalDifferences-maxDifferences),
  unverifiable:gaps,
  limitations:[...new Set([...approved.notRetrieved,...current.notRetrieved])].sort(),
  message:approvedHash===currentHash&&!gaps.length?'No drift was found in the bounded metadata inventory.':'The bounded Salesforce metadata baseline changed or could not be verified. Reanalyze and renew affected approvals before continuing.'
 };
}
