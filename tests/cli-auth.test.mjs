import test from 'node:test';
import assert from 'node:assert/strict';
import {cliAuthentication} from '../runner/cli-auth.mjs';
test('current CLI credentials use the dedicated command, not redacted display output',async()=>{
 const calls=[];const result=await cliAuthentication(async(bin,args)=>{calls.push(args);return {stdout:JSON.stringify({status:0,result:args.includes('show-access-token')?{accessToken:'synthetic-secret'}:{instanceUrl:'https://test.my.salesforce.com',username:'user@example.test'}})};});
 assert.equal(calls.length,2);assert.ok(calls[1].includes('show-access-token'));assert.equal(result.connection.accessToken,'synthetic-secret');assert.equal(result.auth.accessToken,undefined);
});
test('CLI errors never propagate stdout, stderr, credential values or raw error details',async()=>{
 await assert.rejects(()=>cliAuthentication(async()=>{throw Object.assign(Error('SECRET'),{stdout:'SECRET',stderr:'SECRET'});}),e=>!JSON.stringify(e).includes('SECRET')&&!e.message.includes('SECRET'));
 await assert.rejects(()=>cliAuthentication(async()=>({stdout:'{"status":1,"result":{"accessToken":"SECRET"}}'})),/unavailable/);
});
