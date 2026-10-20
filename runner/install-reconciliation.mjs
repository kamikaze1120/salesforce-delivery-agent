import {execFileSync} from 'node:child_process';
const version=process.env.SALESFORCE_CLI_VERSION;
if(!/^\d+\.\d+\.\d+$/.test(version||''))throw new Error('Set SALESFORCE_CLI_VERSION to an exact reviewed version.');
execFileSync('npm',['install','--no-save','--package-lock=false','--ignore-scripts',`@salesforce/cli@${version}`],{stdio:'inherit'});
