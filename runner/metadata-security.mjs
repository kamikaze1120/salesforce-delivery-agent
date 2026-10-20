import {parseXml,one,many,boolean,scalar} from '../lib/xml.mjs';
import {assert} from '../lib/core.mjs';
const keys=(node,allowed)=>assert(Object.keys(node).every(k=>allowed.includes(k)),'Metadata contains a field outside the reviewed security policy.');
export function metadataSecurity(file){
 const p=file.path;
 if(p==='package.xml'){one(parseXml(file.content).Package,'Package');return;}
 if(/\.cls-meta\.xml$/.test(p)){const n=one(parseXml(file.content).ApexClass,'ApexClass');keys(n,['apiVersion','status','packageVersions']);return;}
 if(/^objects\/[A-Za-z][A-Za-z0-9_]*__c\.object$/.test(p)){
  const n=one(parseXml(file.content).CustomObject,'CustomObject');
  keys(n,['label','pluralLabel','description','deploymentStatus','nameField','fields','sharingModel','externalSharingModel','enableActivities','enableReports','enableSearch','enableSharing','enableBulkApi','enableStreamingApi']);
  assert(n.sharingModel==='Private'&&(!n.externalSharingModel||n.externalSharingModel==='Private'),'New custom objects require private internal and external sharing.');
  if(n.enableSharing!==undefined)assert(boolean(n.enableSharing,'enableSharing'),'Sharing cannot be disabled.');
  if(n.nameField)keys(one(n.nameField,'nameField'),['label','type','displayFormat','startingNumber']);
  for(const f of many(n.fields)){
   const field=one(f,'CustomField');keys(field,['fullName','label','description','inlineHelpText','type','length','precision','scale','required','unique','externalId','defaultValue','visibleLines']);
   assert(['Text','LongTextArea','Number','Currency','Percent','Date','DateTime','Checkbox','Email','Phone','Url','AutoNumber'].includes(field.type),'Relationships, formulas and other field types need additional reviewed security coverage.');
  }
  return;
 }
 if(/^permissionsets\/[A-Za-z][A-Za-z0-9_]*\.permissionset$/.test(p)){
  const n=one(parseXml(file.content).PermissionSet,'PermissionSet');
  keys(n,['label','description','hasActivationRequired','objectPermissions','fieldPermissions','classAccesses','userPermissions']);
  for(const x of many(n.userPermissions)){
   const r=one(x,'userPermissions');keys(r,['name','enabled']);scalar(r.name,'permission name');assert(!boolean(r.enabled,'enabled'),'Generated system permissions are prohibited by this policy.');
  }
  for(const x of many(n.objectPermissions)){
   const r=one(x,'objectPermissions');keys(r,['object','allowCreate','allowDelete','allowEdit','allowRead','modifyAllRecords','viewAllRecords','viewAllFields']);scalar(r.object,'object');
   for(const k of Object.keys(r).filter(k=>k!=='object')){const value=boolean(r[k],k);assert(!['modifyAllRecords','viewAllRecords','viewAllFields'].includes(k)||!value,'Broad object access is prohibited.');}
  }
  for(const x of many(n.fieldPermissions)){const r=one(x,'fieldPermissions');keys(r,['field','editable','readable']);scalar(r.field,'field');boolean(r.editable,'editable');boolean(r.readable,'readable');}
  for(const x of many(n.classAccesses)){const r=one(x,'classAccesses');keys(r,['apexClass','enabled']);scalar(r.apexClass,'apexClass');boolean(r.enabled,'enabled');}
  return;
 }
 throw new Error('Metadata type needs an additional reviewed security policy.');
}
