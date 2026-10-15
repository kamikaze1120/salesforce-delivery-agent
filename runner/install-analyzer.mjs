import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,delimiter} from 'node:path';

// Shared by the release installer and the credential-free integration check.
export function installAnalyzer(env=process.env){
 if(!/^5\.\d+\.\d+$/.test(env.CODE_ANALYZER_VERSION||'')||!env.RUNNER_TEMP)throw new Error('Code Analyzer v5 and RUNNER_TEMP are required.');
 const home=join(env.RUNNER_TEMP,'delivery-analyzer-home');
 mkdirSync(home,{recursive:true,mode:0o700});
 const pin=join(home,'delivery-analyzer-pin.json');
 rmSync(pin,{force:true});
 const clean={PATH:resolve('node_modules/.bin')+delimiter+(env.PATH||''),HOME:home,SF_DISABLE_TELEMETRY:'true',SF_AUTOUPDATE_DISABLE:'true'};
 if(env.JAVA_HOME)clean.JAVA_HOME=env.JAVA_HOME;
 execFileSync('java',['-version'],{env:clean,stdio:'inherit'});
 execFileSync(resolve('node_modules/.bin/sf'),['plugins','install',`@salesforce/plugin-code-analyzer@${env.CODE_ANALYZER_VERSION}`],{env:clean,stdio:'inherit',timeout:300000});
 writeFileSync(pin,JSON.stringify({version:env.CODE_ANALYZER_VERSION}),{mode:0o600});
}
