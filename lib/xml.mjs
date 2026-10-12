import {XMLParser, XMLValidator} from 'fast-xml-parser';

// Treat all namespace spellings of a local name equally for safety policy.
// DTDs and user-defined entities are never accepted.
export function parseXml(source) {
  if(typeof source!=='string'||Buffer.byteLength(source)>5000000||/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('Unsafe or oversized XML.');
  const valid=XMLValidator.validate(source);
  if(valid!==true)throw new Error('Malformed XML.');
  return new XMLParser({removeNSPrefix:true,ignoreAttributes:true,parseTagValue:false,trimValues:true,htmlEntities:{}}).parse(source);
}
export function one(value,label) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Missing or ambiguous '+label+'.');
  return value;
}
export const many=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export function scalar(value,label) {
  if(typeof value!=='string')throw new Error('Missing or ambiguous '+label+'.');
  return value;
}
export function boolean(value,label) {
  const text=scalar(value,label);
  if(!['true','false','1','0'].includes(text))throw new Error('Invalid '+label+'.');
  return text==='true'||text==='1';
}
