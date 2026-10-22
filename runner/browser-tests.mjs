import {browserNetworkPolicy} from '../lib/browser-policy.mjs';
import {executeBrowserSteps} from './browser-evidence.mjs';
import {assert} from '../lib/core.mjs';
export async function runBrowserTests(scenarios,target,state,{beforeStep=async()=>{}}={}){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const results=[];
  try{
    for(const scenario of scenarios){
      if(target.name==='production')assert(scenario.steps.every(s=>['goto','assertVisible','assertText'].includes(s.action)),'Production browser tests must be read-only.');
      const started=performance.now();
      const context=await browser.newContext({storageState:state,serviceWorkers:'block'});
      // A compromised generated URL or page cannot send data to arbitrary hosts.
      const network=browserNetworkPolicy(target),lightning=network.lightning;
      await context.route('**/*',route=>network.allows(route.request().url())?route.continue():route.abort());
      const page=await context.newPage();
      const observed=await executeBrowserSteps(page,scenario.steps,{beforeStep,navigate:path=>page.goto(`https://${lightning}${path}`,{waitUntil:'domcontentloaded'})});
      const networkEvidence=network.evidence(),status=networkEvidence.status==='blocked'?'blocked':observed.status;
      results.push({id:scenario.id,passed:status==='passed',status,network:networkEvidence,steps:observed.steps,elapsedMs:performance.now()-started,kind:'browser',reason:status==='passed'?'Assertions passed.':'Inspect redacted step diagnostics; missing execution is blocked.'});
      await context.close();
    }
  }finally{await browser.close();}
  return results;
}
