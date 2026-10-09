import {execFileSync} from 'node:child_process';
for(const key of ['SALESFORCE_CLI_VERSION','PLAYWRIGHT_VERSION'])if(!/^\d+\.\d+\.\d+$/.test(process.env[key]||''))throw new Error(`Set ${key} to an exact reviewed release version.`);
execFileSync('npm',['install','--no-save','--package-lock=false','--ignore-scripts',`@salesforce/cli@${process.env.SALESFORCE_CLI_VERSION}`,`playwright@${process.env.PLAYWRIGHT_VERSION}`],{stdio:'inherit'});
execFileSync('node_modules/.bin/playwright',['install','--with-deps','chromium'],{stdio:'inherit'});
