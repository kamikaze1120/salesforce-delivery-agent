import {hash} from '../lib/core.mjs';
// Preserve hashes and observed outcomes, never page contents, inputs, cookies, URLs or exception text.
export async function executeBrowserSteps(page,steps,{beforeStep=async()=>{},navigate,now=()=>performance.now()}={}){
 const observations=[];let stopped=false;
 for(const [index,step] of steps.entries()){
  const row={id:`STEP-${index+1}`,index,action:step.action,stepHash:hash(step),assertion:step.action.startsWith('assert'),status:'skipped',durationMs:0};observations.push(row);
  if(stopped)continue;
  await beforeStep();const started=now();
  try{
   if(step.action==='goto')await navigate(step.path);
   else{
    const locator=step.by==='label'?page.getByLabel(step.target,{exact:true}):step.by==='testId'?page.getByTestId(step.target):page.getByText(step.target,{exact:true});
    if(step.action==='click')await locator.click({timeout:15000});
    else if(step.action==='fill')await locator.fill(step.value,{timeout:15000});
    else if(step.action==='assertVisible')await locator.waitFor({state:'visible',timeout:15000});
    else if(step.action==='assertText'){
     await locator.waitFor({state:'visible',timeout:15000});
     const actual=await locator.innerText();row.expectedHash=hash(step.value);row.actualHash=hash(actual);
     if(actual!==step.value){row.status='failed';row.diagnostic='text_mismatch';stopped=true;}
    }else throw new Error('unsupported');
   }
   if(row.status!=='failed')row.status='passed';
  }catch{row.status='blocked';row.diagnostic='navigation_locator_session_or_network';stopped=true;}
  row.durationMs=Math.max(0,now()-started);
 }
 return {status:observations.some(o=>o.status==='blocked')?'blocked':observations.some(o=>o.status==='failed')?'failed':observations.length&&observations.some(o=>o.assertion)&&observations.every(o=>o.status==='passed')?'passed':'blocked',steps:observations};
}
