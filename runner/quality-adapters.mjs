// Deterministic adapters consume observed runner evidence, never model pass claims.
const check=(status,source,reason,details={})=>({status,source,reason,...details});
export function coverageCheck(artifacts,validation,minimum=75){
 const source='Salesforce Metadata API checkDeployStatus / runTestResult.codeCoverage';
 const classes=artifacts.files.filter(f=>/^classes\/.*\.cls$/.test(f.path)&&!/@isTest\b/i.test(f.content)).map(f=>f.path.slice(8,-4));
 if(!classes.length)return check('not_applicable',source,'This package contains no implementation Apex classes. Salesforce deployment test requirements still apply.');
 if(!validation?.done||!validation.success)return check('blocked',source,'Successful package validation is required.');
 if(!Number.isFinite(minimum)||minimum<75||minimum>100)return check('blocked',source,'Invalid reviewed coverage threshold.');
 const rows=classes.map(name=>{
  const candidates=(validation.coverage||[]).filter(r=>r.name===name&&!r.namespace);
  if(candidates.length!==1)return {name,status:'unknown'};
  const r=candidates[0];
  if(!Number.isInteger(r.locations)||r.locations<=0||!Number.isInteger(r.uncovered)||r.uncovered<0||r.uncovered>r.locations)return {name,status:'unknown'};
  const percent=100*(r.locations-r.uncovered)/r.locations;
  return {name,locations:r.locations,uncovered:r.uncovered,percent,status:percent>=minimum?'passed':'failed'};
 });
 const status=rows.some(r=>r.status==='unknown')?'blocked':rows.every(r=>r.status==='passed')?'passed':'failed';
 return check(status,source,'Per-changed-class coverage policy; this is not an assertion of org-wide coverage.',{minimum,classes:rows});
}
export function businessCheck(cases,suite,results){
 const source='Approved requirement cases mapped to executed runner scenarios';
 if(!cases?.length)return check('blocked',source,'No structured acceptance cases supplied.');
 const rows=cases.map(c=>{
  const scenarios=suite.scenarios.filter(s=>s.caseId===c.id&&s.expected===c.expected&&s.requirements.includes(c.requirementId));
  const observed=scenarios.map(s=>({scenarioId:s.id,results:results.filter(r=>r.id===s.id)}));
  const status=!observed.length||observed.some(o=>o.results.length!==1)?'blocked':observed.every(o=>o.results[0].passed===true)?'passed':'failed';
  return {caseId:c.id,requirementId:c.requirementId,acceptanceIndex:c.acceptanceIndex,expected:c.expected,status,scenarios:observed.map(o=>({id:o.scenarioId,passed:o.results[0]?.passed??null}))};
 });
 return check(rows.some(r=>r.status==='blocked')?'blocked':rows.every(r=>r.status==='passed')?'passed':'failed',source,'All frozen acceptance cases must map to an observed passing scenario. Semantic adequacy of assertions still requires test review.',{cases:rows});
}
export function collectQuality({artifacts,validation,cases,testSuite,tests}){
 const pending=name=>check('blocked','No verified '+name+' adapter','A reviewed adapter and applicable policy are required; this is not a pass.');
 return {artifactHash:artifacts.hash,checks:{coverage:coverageCheck(artifacts,validation),business:businessCheck(cases,testSuite,tests),security:pending('security'),performance:pending('performance'),license:pending('destination license'),regression:pending('baseline regression'),flow:artifacts.files.some(f=>f.path.startsWith('flows/'))?pending('Flow execution'):check('not_applicable','Immutable package manifest','No Flow metadata is changed. Flow side effects of other changes remain part of business and regression tests.')}};
}
