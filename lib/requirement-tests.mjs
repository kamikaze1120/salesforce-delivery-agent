import {assert,string} from './core.mjs';
export function requirementTests(raw,plan){
 assert(Array.isArray(raw)&&raw.length>0&&raw.length<=100,'Analysis must produce 1–100 structured requirement test cases.');
 const cases=raw.map((t,i)=>{
  const requirement=plan.requirements.find(r=>r.id===t.requirementId);
  assert(requirement,'Requirement test references an unknown requirement.');
  assert(Number.isInteger(t.acceptanceIndex)&&t.acceptanceIndex>=0&&t.acceptanceIndex<requirement.acceptance.length,'Requirement test must cite a valid acceptance criterion index.');
  assert(['positive','negative','access','bulk','regression','business','flow'].includes(t.category),'Invalid requirement test category.');
  assert(Array.isArray(t.steps)&&t.steps.length>0&&t.steps.length<=30,'Requirement test needs 1–30 steps.');
  return {id:`CASE-${i+1}`,requirementId:t.requirementId,acceptanceIndex:t.acceptanceIndex,category:t.category,title:string(t.title,'Test title',200),preconditions:string(t.preconditions,'Preconditions',2000),steps:t.steps.map(s=>string(s,'Test step',1000)),expected:string(t.expected,'Expected test result',2000),status:'not_run'};
 });
 assert(plan.requirements.every(r=>r.acceptance.every((_,index)=>cases.some(c=>c.requirementId===r.id&&c.acceptanceIndex===index))),'Every acceptance criterion must have a requirement-time test case.');
 return cases;
}
