import {assert,hash} from './core.mjs';
export const qualityCategories=['coverage','security','performance','license','regression','business','flow'];
export function qualityGate(evidence,artifactHash){
 assert(evidence?.artifactHash===artifactHash,'Quality evidence must match the exact release.',409);
 const checks=qualityCategories.map(category=>{
  const item=evidence.checks?.[category];
  const valid=item&&['passed','not_applicable'].includes(item.status)&&typeof item.source==='string'&&item.source.length>0&&typeof item.reason==='string'&&item.reason.length>0;
  // Applicability decisions are reviewable evidence; an empty suite is never a pass.
  return {category,status:valid?item.status:'blocked',source:item?.source||'missing',reason:item?.reason||'Required quality evidence has not been produced.'};
 });
 return {artifactHash,checks,passed:checks.every(c=>c.status!=='blocked'),hash:hash(checks)};
}
export function requireQuality(evidence,artifactHash){const gate=qualityGate(evidence,artifactHash);assert(gate.passed,'Quality gate blocked: '+gate.checks.filter(c=>c.status==='blocked').map(c=>c.category).join(', '),409);return gate;}
