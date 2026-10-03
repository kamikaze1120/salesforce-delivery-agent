import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('sample UI renders key views and escapes untrusted requirement content',async()=>{
  const root={innerHTML:'',insertAdjacentHTML(){}},toast={textContent:'',className:''};
  const context=vm.createContext({document:{querySelector:s=>s==='#app'?root:s==='#toast'?toast:null,addEventListener(){},body:{insertAdjacentHTML(){}}},fetch:async()=>({ok:true,json:async()=>({configured:false})}),location:{origin:'http://localhost:3000'},URLSearchParams,FormData,structuredClone,crypto:{randomUUID:()=> 'sample'},setTimeout,clearTimeout,console});
  vm.runInContext(await readFile('public/app.js','utf8'),context);
  vm.runInContext('demo()',context);assert.match(root.innerHTML,/SAMPLE WORKSPACE/);assert.match(root.innerHTML,/Service Request Priority/);
  vm.runInContext("state.view='connections';render()",context);assert.match(root.innerHTML,/Client secret/);assert.match(root.innerHTML,/<button type="button"[^>]*data-act="verify"/);assert.match(root.innerHTML,/0 \/ 5 configured or verified/);assert.match(root.innerHTML,/Connection editing is disabled/);
  vm.runInContext("state.view='job';state.jobId=state.jobs[0].id;state.jobs[0].data.plan.summary='<img src=x onerror=evil()>';render()",context);
  assert.match(root.innerHTML,/&lt;img src=x onerror=evil\(\)&gt;/);assert.doesNotMatch(root.innerHTML,/<img src=x/);
  for(const tab of ['stories','files','tests'])vm.runInContext(`state.jobTab='${tab}';render()`,context);
  assert.match(root.innerHTML,/Not run/);
});

test('synthetic identities exercise clarification, human review, pause, and role restrictions',async()=>{
  const root={innerHTML:'',insertAdjacentHTML(){}},toast={textContent:'',className:''};
  const context=vm.createContext({document:{querySelector:s=>s==='#app'?root:s==='#toast'?toast:null,addEventListener(){},body:{insertAdjacentHTML(){}}},fetch:async()=>({ok:true,json:async()=>({configured:false})}),location:{origin:'http://localhost:3000'},URLSearchParams,FormData,structuredClone,crypto:{randomUUID:()=> 'sample'},setTimeout,clearTimeout,console});
  vm.runInContext(await readFile('public/app.js','utf8'),context);
  vm.runInContext("demo();state.jobId=state.jobs[0].id;state.view='job'",context);
  assert.throws(()=>vm.runInContext("demoAction('approvePlan',{})",context),/blocking/);
  vm.runInContext("state.ws.role='viewer';render()",context);
  assert.equal(vm.runInContext('roleCanWrite()',context),false);assert.equal(vm.runInContext('roleCanReview()',context),false);
  assert.throws(()=>vm.runInContext("demoAction('analyze',{})",context),/cannot/);
  vm.runInContext("state.ws.role='developer';demoAction('analyze',{answers:Object.fromEntries(samplePlan.questions.map(q=>[q.question,'Synthetic answer for review']))})",context);
  assert.equal(vm.runInContext('currentJob().stage',context),'plan_review');
  assert.throws(()=>vm.runInContext("demoAction('approvePlan',{})",context),/cannot/);
  vm.runInContext("state.ws.role='reviewer';demoAction('pause',{})",context);
  assert.throws(()=>vm.runInContext("demoAction('approvePlan',{})",context),/paused/);
  vm.runInContext("demoAction('resume',{});demoAction('approvePlan',{})",context);
  assert.equal(vm.runInContext('currentJob().stage',context),'approved');
  assert.equal(vm.runInContext('state.events.length',context),4);
  vm.runInContext("state.ws.role='developer'",context);
  assert.throws(()=>vm.runInContext("demoAction('generate',{})",context),/live connections/);
});
