// Read-only setup probe: no artifacts, deployments, test execution or app callbacks.
import {mkdtemp,writeFile,rm,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SalesforceMcp} from './mcp-client.mjs';
import {setupConfiguration} from './setup-config.mjs';
const e=process.env,exec=promisify(execFile);let dir,mcp;
let phase='configuration';
try{
 const target=setupConfiguration(e);
 if(process.argv.includes('--config-only'))console.log('Setup configuration present; live authentication not yet checked.');
 else {
  dir=await mkdtemp(join(tmpdir(),'delivery-setup-'));
  await writeFile(join(dir,'jwt.key'),e.SF_JWT_PRIVATE_KEY,{mode:0o600});
  await writeFile(join(dir,'target.json'),JSON.stringify(target),{mode:0o600});
  const env={PATH:e.PATH,HOME:dir,SF_DISABLE_TELEMETRY:'true',SFDX_DISABLE_TELEMETRY:'true'};
  phase='JWT authentication';
  const auth=await exec('sf',['org','login','jwt','--username',e.SF_USERNAME,'--client-id',e.SF_CLIENT_ID,'--jwt-key-file',join(dir,'jwt.key'),'--instance-url',target.url,'--alias','delivery-target','--json'],{env,timeout:120000,maxBuffer:2e6});
  if(JSON.parse(auth.stdout).status!==0)throw Error('Authentication failed');
  phase='MCP discovery and org identity';
  mcp=new SalesforceMcp({...env,DELIVERY_MCP_MODE:'setup',DELIVERY_TARGET_FILE:join(dir,'target.json')});
  await mcp.initialize();await mcp.call('inspect_org');
  const report=`## Read-only Salesforce setup verification\n\nStage: ${target.name}\n\nRunner: ${e.GITHUB_SHA}\n\nJWT login, restricted MCP discovery and expected non-production org identity: passed.\n\nThis does not certify browser sessions, deployment permissions, quality policies, tests or production readiness. No Salesforce metadata or business records were changed.\n`;
  console.log(report);if(e.GITHUB_STEP_SUMMARY)await appendFile(e.GITHUB_STEP_SUMMARY,report);
 }
}catch{
 const report=`Setup verification failed at ${phase}. Check target variables, environment credentials and protected main. Credential and provider output suppressed.\n`;
 console.error(report);if(e.GITHUB_STEP_SUMMARY)await appendFile(e.GITHUB_STEP_SUMMARY,report);process.exitCode=1;
}finally{mcp?.close();if(dir)await rm(dir,{recursive:true,force:true});}
