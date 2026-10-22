import test from 'node:test';
import assert from 'node:assert/strict';
import {executeBrowserSteps} from '../runner/browser-evidence.mjs';
const steps=[{action:'goto',path:'/lightning/o/Account/list'},{action:'assertText',by:'text',target:'Status',value:'Approved'},{action:'assertVisible',by:'text',target:'Done'}];
function page(actual='Approved',error=false){const locator={waitFor:async()=>{if(error)throw Error('secret session token');},innerText:async()=>actual};return {getByText:()=>locator};}
test('browser evidence distinguishes assertions, failed comparisons, blocked locators and skipped steps without raw data',async()=>{
 const good=await executeBrowserSteps(page(),steps,{navigate:async()=>{}});assert.equal(good.status,'passed');assert.equal(good.steps.length,3);
 const bad=await executeBrowserSteps(page('private customer value'),steps,{navigate:async()=>{}});assert.equal(bad.status,'failed');assert.equal(bad.steps[2].status,'skipped');assert.ok(!JSON.stringify(bad).includes('private customer'));
 const blocked=await executeBrowserSteps(page('',true),steps,{navigate:async()=>{}});assert.equal(blocked.status,'blocked');assert.ok(!JSON.stringify(blocked).includes('secret'));
 assert.equal((await executeBrowserSteps(page(),[steps[0]],{navigate:async()=>{}})).status,'blocked');
});
test('pause at step boundaries propagates and cannot be converted into a failed code assertion',async()=>{
 await assert.rejects(()=>executeBrowserSteps(page(),steps,{beforeStep:async()=>{throw Error('paused');}}),/paused/);
});
