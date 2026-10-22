import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assert,origin} from '../lib/core.mjs';
const exec=promisify(execFile);
export async function cliAuthentication(run=exec){
 async function read(args){
  try{const raw=JSON.parse((await run('sf',args,{maxBuffer:2e6,timeout:120000})).stdout);assert(raw.status===0&&raw.result,'CLI authentication unavailable.');return raw.result;}
  catch{throw new Error('Salesforce CLI authentication unavailable. Reauthorize the exact configured target; credential output is suppressed.');}
 }
 const auth=await read(['org','display','--target-org','delivery-target','--json']);
 const secret=await read(['org','auth','show-access-token','--target-org','delivery-target','--json']);
 assert(typeof secret.accessToken==='string'&&secret.accessToken.length>0,'Salesforce authentication token is missing.');
 return {auth,connection:{instanceUrl:origin(auth.instanceUrl,'Salesforce'),accessToken:secret.accessToken}};
}
