// Per-file review summary (B54). Pure, read-only description of each generated metadata file so a
// reviewer can scan intent before approving, instead of reading raw XML. No external calls — it
// derives only from the artifact text already in hand. Apex/trigger -meta.xml companions and the
// server-built package.xml are folded out so each change appears once.
const count=(s,re)=>(s.match(re)||[]).length;
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
const nonZero=h=>!/^0\s/.test(h);

function describe(path, content) {
  const bytes=Buffer.byteLength(content);
  if(/\.cls$/.test(path)){
    const sharing=/\bwith sharing\b/.test(content)?'with sharing':/\bwithout sharing\b/.test(content)?'without sharing':/\binherited sharing\b/.test(content)?'inherited sharing':'no sharing declared';
    const methods=count(content,/\b(?:public|private|protected|global)\b[^;{]*\b\w+\s*\([^)]*\)\s*\{/g);
    return {kind:'Apex class',bytes,highlights:[sharing,plural(methods,'method')]};
  }
  if(/\.trigger$/.test(path)){
    const m=content.match(/trigger\s+\w+\s+on\s+(\w+)\s*\(([^)]*)\)/i);
    const obj=m?m[1]:'unknown object';
    const events=m?m[2].split(',').map(e=>e.trim()).filter(Boolean).join(', '):'';
    return {kind:'Apex trigger',bytes,highlights:[obj,events].filter(Boolean)};
  }
  if(/\.object$/.test(path)){
    return {kind:'Custom object',bytes,highlights:[plural(count(content,/<fields>/g),'field'),plural(count(content,/<validationRules>/g),'validation rule'),plural(count(content,/<recordTypes>/g),'record type')].filter(nonZero)};
  }
  if(/\.flow$/.test(path)){
    const status=content.match(/<status>([^<]+)<\/status>/)?.[1]||'unknown status';
    return {kind:'Flow',bytes,highlights:[status]};
  }
  if(/\.permissionset$/.test(path)){
    return {kind:'Permission set',bytes,highlights:[plural(count(content,/<userPermissions>/g),'user permission'),plural(count(content,/<objectPermissions>/g),'object')].filter(nonZero)};
  }
  if(/\.app$/.test(path)){
    const label=content.match(/<label>([^<]+)<\/label>/)?.[1]||'';
    return {kind:'Lightning app',bytes,highlights:[label,plural(count(content,/<tabs>/g),'tab')].filter(Boolean)};
  }
  if(/\.tab$/.test(path)){
    return {kind:'Custom tab',bytes,highlights:[/customObject>\s*true/.test(content)?'Custom object tab':'Tab']};
  }
  if(/^lwc\//.test(path)) return {kind:'Lightning web component',bytes,highlights:[path.split('/').pop()]};
  return {kind:'Metadata',bytes,highlights:[]};
}

export function artifactReview(artifacts) {
  const files=(artifacts?.files||[]).filter(f=>f.path!=='package.xml' && !/\.cls-meta\.xml$/.test(f.path) && !/\.trigger-meta\.xml$/.test(f.path));
  return files.map(f=>({path:f.path,...describe(f.path,f.content)}));
}
