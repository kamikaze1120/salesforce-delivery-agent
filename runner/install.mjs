import {execFileSync} from 'node:child_process';
import {installAnalyzer} from './install-analyzer.mjs';
execFileSync('npm',['ci','--ignore-scripts'],{stdio:'inherit'});
for(const key of ['SALESFORCE_CLI_VERSION','PLAYWRIGHT_VERSION','CODE_ANALYZER_VERSION'])if(!/^\d+\.\d+\.\d+$/.test(process.env[key]||''))throw new Error(`Set ${key} to an exact reviewed release version.`);
if(!process.env.CODE_ANALYZER_VERSION.startsWith('5.')||!process.env.RUNNER_TEMP)throw new Error('Code Analyzer v5 and RUNNER_TEMP are required.');
execFileSync('npm',['install','--no-save','--package-lock=false','--ignore-scripts',`@salesforce/cli@${process.env.SALESFORCE_CLI_VERSION}`,`playwright@${process.env.PLAYWRIGHT_VERSION}`],{stdio:'inherit'});
execFileSync('node_modules/.bin/playwright',['install','--with-deps','chromium'],{stdio:'inherit'});
installAnalyzer();
