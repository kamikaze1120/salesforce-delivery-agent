import assert from 'node:assert/strict';
import {hash} from '../lib/core.mjs';
import {installAnalyzer} from '../runner/install-analyzer.mjs';
import {runSecurity} from '../runner/security.mjs';

// Real scanner, synthetic source, no Salesforce account or deployment credentials.
installAnalyzer();
for(const [name,content,expected] of [
 ['CleanFixture','public with sharing class CleanFixture { public static Integer answer() { return 42; } }','passed'],
 ['UnsafeFixture','public with sharing class UnsafeFixture { public static List<SObject> search(String input) { return Database.query(input); } }','failed']
]){
 const files=[{path:`classes/${name}.cls`,content}];
 const evidence=await runSecurity({files,hash:hash(files)});
 console.log(JSON.stringify({fixture:name,status:evidence.status,reason:evidence.reason,versions:evidence.versions,findings:evidence.findings}));
 assert.equal(evidence.status,expected,`${name}: actual scanner must return ${expected}`);
 if(expected==='failed')assert.ok(evidence.findings.some(f=>f.rule==='ApexSOQLInjection'),'Unsafe fixture must exercise the intended security rule.');
}
