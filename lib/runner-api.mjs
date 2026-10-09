import {releaseReport,requireBusinessApproval} from './release-report.mjs';
import {assert,uuid,hash,AppError} from './core.mjs';
import {db,connection,lock,updateJob,checkpoint} from './store.mjs';
import {verifyRunnerToken,nextStage,evidenceResult,dispatchPipeline,sendDispatch,verifyPipeline} from './pipeline.mjs';
import {repairArtifacts} from './delivery.mjs';
import {commitArtifacts} from './integrations.mjs';

export async function runnerRequest(req,b){
  const workspaceId=uuid(b.workspaceId),jobId=uuid(b.jobId),pipelineId=uuid(b.pipelineId);
  const [ws]=await db('workspaces',`id=eq.${workspaceId}`);
  const [original]=await db('jobs',`id=eq.${jobId}&workspace_id=eq.${workspaceId}`);
  assert(ws&&original,'Delivery not found.',404);
  const {config:c}=await connection(ws,'github'),run=original.data.pipeline;
  assert(run&&run.id===pipelineId&&run.connectionVersion===ws.connection_version,'Pipeline expired or configuration changed.',409);
  assert(Date.now()-Date.parse(run.createdAt)<72*3600000,'Pipeline expired. Request a new reviewed run.',409);
  const identity=await verifyRunnerToken(req.headers.authorization?.replace(/^Bearer /,''),c,run,b.stage);
  assert(!original.data.paused,'Delivery paused by a reviewer.',409);
  const actor={id:run.requestedBy,email:'github-actions'},job=await lock(original,'pipeline.'+b.action);
  const data=structuredClone(job.data);let response;
  try{
    const p=data.pipeline;
    if(b.action==='context'){
      assert(['queued','running','awaiting_business_approval'].includes(p.status),'Pipeline is not active.',409);
      await verifyPipeline(c);
      if(b.stage==='production') requireBusinessApproval(data);
      const target=nextStage(p,b.stage);
      p.status='running';p.runUrl=identity.url;
      p.stages.push({name:b.stage,status:'running',artifactHash:p.artifactHash,runId:identity.runId,startedAt:new Date().toISOString()});
      response={target,requirementCases:data.plan.testCases||[],artifacts:data.artifacts,testSuite:data.testSuite,manualEvidence:data.manualEvidence||{},policy:p.policy};
    }else if(b.action==='report'){
      const stage=p.stages.find(s=>s.name===b.stage&&s.status==='running'&&s.runId===identity.runId);
      assert(stage,'No matching claimed stage.',409);
      const evidence=evidenceResult(b.evidence,p,identity.target);
      if(evidence.status==='passed'){
        assert(data.testSuite.scenarios.every(s=>evidence.tests.some(t=>t.id===s.id&&t.passed===true)),'Evidence is missing a required scenario.',409);
      }
      Object.assign(stage,evidence);
      p.status=evidence.status==='passed'?(b.stage==='production'?'complete':b.stage==='uat'?'awaiting_business_approval':'running'):['unknown','blocked'].includes(evidence.status)?'stopped':'failed';
      if(evidence.status==='unknown'){data.paused=true;data.reconciliationRequired=true;}
      if(b.stage==='uat'&&evidence.status==='passed')data.releaseReport=releaseReport(data);
      response={status:p.status,repairEligible:p.status==='failed'&&b.stage!=='production'&&p.repairs<p.policy.maxRepairs};
    }else if(b.action==='repair'){
      assert(p.status==='failed'&&b.stage!=='production'&&p.repairs<p.policy.maxRepairs,'Automatic repair budget exhausted or repair is not permitted.',409);
      assert(p.stages.some(s=>s.name===b.stage&&s.status==='failed'&&s.runId===identity.runId),'No observed failure from this runner.',409);
      assert(hash(data.brd)===p.brdHash&&hash(data.plan)===p.planHash&&data.mockup.hash===p.mockupHash&&data.testSuite.hash===p.testHash&&data.architecture.hash===p.architectureHash,'Approved requirements or tests changed.',409);
      p.repairs++;
      // Persist budget before the model call. Crashes do not give unlimited attempts.
      await checkpoint(job,job.stage,data);
      const {config:llm}=await connection(ws,'llm');
      const result=await repairArtifacts(llm,data,p.stages.find(s=>s.name===b.stage));
      data.artifacts=result.output;delete data.businessApproval;delete data.releaseReport;
      data.generations=[...(data.generations||[]),{kind:'repair',model:result.model,usage:result.usage,at:new Date().toISOString(),originalBrdHash:p.brdHash}];
      data.operation={kind:'pipelineRepair',phase:'write_started',at:new Date().toISOString()};await checkpoint(job,job.stage,data);
      data.git=await commitArtifacts(c,data.artifacts,job.id,job.title,data.git);
      data.operation.phase='response_recorded';await checkpoint(job,job.stage,data);
      data.pipeline=await dispatchPipeline(c,ws,job,data,actor);
      // Store the new correlation ID BEFORE dispatch; ambiguous dispatch is never repeated.
      data.operation={kind:'pipelineDispatch',phase:'write_started',at:new Date().toISOString()};await checkpoint(job,job.stage,data);
      await sendDispatch(c,ws,job,data.pipeline);data.operation.phase='response_recorded';
      response={status:'restarted',pipelineId:data.pipeline.id};
    }else throw new AppError('Unsupported runner action.');
    await updateJob(job,job.stage,data,actor,'pipeline.'+b.action);
    return response;
  }catch(error){
    if(data.operation?.phase==='write_started'){data.paused=true;data.reconciliationRequired=true;data.pipeline.status='stopped';}
    if(b.action==='repair')data.pipeline.status='stopped';
    data.lastError=error instanceof AppError?error.message:'Pipeline operation failed. Review the runner and delivery state.';
    await updateJob(job,job.stage,data,actor,'pipeline.'+b.action+'.failed');throw error;
  }
}
