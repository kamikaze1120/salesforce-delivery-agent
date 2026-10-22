import {createHash} from 'node:crypto';
import {assert,hash,sourceFormat} from './core.mjs';
const blobHash=text=>createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
export function packageChanges(artifacts,root,previous,inventory){
 assert(hash(artifacts.files)===artifacts.hash,'Artifact integrity mismatch.',409);
 assert(typeof root==='string'&&/^[A-Za-z0-9_/-]+$/.test(root)&&!root.includes('..')&&!root.startsWith('/')&&!root.endsWith('/'),'Invalid source root.');
 assert(inventory&&inventory.truncated===false&&Array.isArray(inventory.tree)&&inventory.tree.length<=50000,'Repository inventory is incomplete or too large.',409);
 const files=sourceFormat(artifacts.files,root);
 assert(new Set(files.map(f=>f.path)).size===files.length,'Duplicate source paths.');
 if(previous)assert(previous.ownership?.version===1&&previous.ownership.root===root&&Array.isArray(previous.ownership.files),'Previous delivery has no verified ownership inventory. Reconcile it before updating.',409);
 const owned=previous?.ownership?.files||[],existing=new Map(inventory.tree.map(f=>[f.path,f]));
 assert(new Set(owned.map(f=>f.path)).size===owned.length,'Duplicate ownership paths.',409);
 for(const f of owned){
  assert(f.path.startsWith(root+'/')&&!f.path.includes('..')&&/^[a-f0-9]{40}$/.test(f.blob),'Invalid ownership record.',409);
  assert(existing.get(f.path)?.type==='blob'&&existing.get(f.path).sha===f.blob,'Owned source changed or disappeared. Reconcile before updating.',409);
 }
 const ownedPaths=new Set(owned.map(f=>f.path)),nextPaths=new Set(files.map(f=>f.path));
 for(const f of files)assert(!existing.has(f.path)||ownedPaths.has(f.path),'Generated source would overwrite an unowned repository file. Review the baseline first.',409);
 const removed=owned.filter(f=>!nextPaths.has(f.path)).map(f=>f.path);
 const tree=[...files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content})),...removed.map(path=>({path,mode:'100644',type:'blob',sha:null}))];
 return {tree,removed,ownership:{version:1,root,artifactHash:artifacts.hash,files:files.map(f=>({path:f.path,blob:blobHash(f.content)}))}};
}
