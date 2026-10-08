import {assert} from '../lib/core.mjs';
export async function runBrowserTests(scenarios,target,state){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const results=[];
  try{
    for(const scenario of scenarios){
      if(target.name==='production')assert(scenario.steps.every(s=>['goto','assertVisible','assertText'].includes(s.action)),'Production browser tests must be read-only.');
      const context=await browser.newContext({storageState:state});
      // A compromised generated URL or page cannot send data to arbitrary hosts.
      const login=new URL(target.url),lightning=login.hostname.replace(/\.my\.salesforce\.com$/,'.lightning.force.com');
      const allowed=new Set([login.hostname,lightning]);
      await context.route('**/*',route=>{const u=new URL(route.request().url());return u.protocol==='https:'&&allowed.has(u.hostname)?route.continue():route.abort();});
      const page=await context.newPage();let passed=true;
      try{
        for(const step of scenario.steps){
          if(step.action==='goto'){await page.goto(`https://${lightning}${step.path}`,{waitUntil:'domcontentloaded'});continue;}
          const locator=step.by==='label'?page.getByLabel(step.target,{exact:true}):step.by==='testId'?page.getByTestId(step.target):page.getByText(step.target,{exact:true});
          if(step.action==='click')await locator.click({timeout:15000});
          else if(step.action==='fill')await locator.fill(step.value,{timeout:15000});
          else if(step.action==='assertVisible')await locator.waitFor({state:'visible',timeout:15000});
          else if(step.action==='assertText'){await locator.waitFor({state:'visible',timeout:15000});assert((await locator.innerText())===step.value,'Text assertion failed.');}
          else throw new Error('Unsupported browser step.');
        }
      }catch{passed=false;}
      results.push({id:scenario.id,passed,kind:'browser',reason:passed?'Assertions passed.':'Browser assertion, locator, authentication or allowed-origin check failed.'});
      await context.close();
    }
  }finally{await browser.close();}
  return results;
}
