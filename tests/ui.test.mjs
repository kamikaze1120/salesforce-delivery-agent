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
