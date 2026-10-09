import {assert,hash} from './core.mjs';
export function releaseReport(data){
 const p=data.pipeline;assert(p,'No pipeline evidence.',409);
 const report={version:1,pipelineId:p.id,artifactHash:p.artifactHash,testHash:p.testHash,brdHash:p.brdHash,planHash:p.planHash,connectionVersion:p.connectionVersion,
 requirements:data.plan.requirements.map(r=>({...r,stories:data.plan.stories.filter(s=>s.requirements?.includes(r.id)).map(s=>({id:s.id,jira:data.jira?.[s.id]||null})),tests:data.testSuite.scenarios.filter(t=>t.requirements.includes(r.id)).map(t=>({id:t.id,title:t.title,expected:t.expected,results:p.stages.map(s=>({stage:s.name,result:s.tests?.find(x=>x.id===t.id)||{status:'not_run'}}))}))})),
 components:data.artifacts.files.map(f=>({path:f.path,hash:hash(f.content)})),stages:structuredClone(p.stages),repairs:p.repairs,history:p.history,risks:data.plan.risks||[],capabilities:data.orgContext.capabilities||null,
 limitations:['Only recorded runner results establish execution. Missing evidence is not a pass.','Production has not completed until its own results are recorded.'],git:data.git};
 return {...report,hash:hash(report)};
}
export function businessApproval(data,userId,note){
 const p=data.pipeline;assert(p?.status==='awaiting_business_approval','Complete UAT before business approval.',409);
 assert(['dev','qa','uat'].every(name=>p.stages.some(s=>s.name===name&&s.status==='passed'&&s.artifactHash===p.artifactHash)),'Dev, QA and UAT must pass for this release.',409);
 const report=releaseReport(data);
 return {userId,note,at:new Date().toISOString(),pipelineId:p.id,artifactHash:p.artifactHash,testHash:p.testHash,reportHash:report.hash,connectionVersion:data.connectionVersion};
}
export function requireBusinessApproval(data){
 const p=data.pipeline,a=data.businessApproval;
 assert(a&&a.pipelineId===p.id&&a.artifactHash===p.artifactHash&&a.testHash===p.testHash&&a.connectionVersion===data.connectionVersion&&a.reportHash===releaseReport(data).hash,'Business approval of the exact UAT report is required before production.',409);
}
