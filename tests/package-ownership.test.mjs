import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactsSchema} from '../lib/core.mjs';
import {packageChanges} from '../lib/package-ownership.mjs';
const root='force-app/main/default',make=names=>artifactsSchema({files:names.flatMap(n=>[{path:`classes/${n}.cls`,content:`public class ${n} {}`},{path:`classes/${n}.cls-meta.xml`,content:'<ApexClass/>'}])});
test('owned files are removed explicitly while unrelated repository content remains untouched',()=>{
 const old=packageChanges(make(['First','Second']),root,null,{truncated:false,tree:[]});
 const tree=old.ownership.files.map(f=>({path:f.path,sha:f.blob,type:'blob'}));tree.push({path:'README.md',sha:'a'.repeat(40),type:'blob'});
 const next=packageChanges(make(['First','Third']),root,{ownership:old.ownership},{truncated:false,tree});
 assert.equal(next.removed.length,2);assert.ok(next.tree.filter(f=>f.sha===null).every(f=>f.path.includes('Second')));assert.ok(!next.tree.some(f=>f.path==='README.md'));
});
test('unowned overwrites, source drift, missing ownership and incomplete inventories block before Git mutation',()=>{
 const a=make(['First']),old=packageChanges(a,root,null,{truncated:false,tree:[]}),tree=old.ownership.files.map(f=>({path:f.path,sha:f.blob,type:'blob'}));
 assert.throws(()=>packageChanges(a,root,null,{truncated:false,tree}),/unowned/);
 assert.throws(()=>packageChanges(a,root,{}, {truncated:false,tree}),/ownership/);
 assert.throws(()=>packageChanges(a,root,null,{truncated:true,tree:[]}),/incomplete/);
 tree[0].sha='b'.repeat(40);assert.throws(()=>packageChanges(a,root,{ownership:old.ownership},{truncated:false,tree}),/changed/);
 assert.throws(()=>packageChanges({...a,hash:'tampered'},root,null,{truncated:false,tree:[]}),/integrity/);
});
