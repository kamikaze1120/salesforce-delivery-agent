import test from 'node:test';
import assert from 'node:assert/strict';
import {businessApproval} from '../lib/release-report.mjs';
import {prepareProduction,dispatchProduction} from '../lib/production-continuation.mjs';
function fixture(){const d={connectionVersion:1,orgContext:{},plan:{requirements:[],stories:[]},testSuite:{scenarios:[]},artifacts:{files:[]},pipeline:{id:'p',status:'awaiting_business_approval',policy:{ref:'main'},artifactHash:'a',testHash:'t',connectionVersion:1,stages:['dev','qa','uat'].map(name=>({name,status:'passed',artifactHash:'a'}))}};d.businessApproval=businessApproval(d,'reviewer','Approved');return d;}
test('late approval dispatch uses a new correlation and never repeats an uncertain dispatch',async()=>{
 const d=fixture();d.pipeline.createdAt='2020-01-01T00:00:00Z';d.pipeline.continuation=prepareProduction(d);
 assert.throws(()=>prepareProduction(d),/already recorded/);
 const old=global.fetch;let calls=0;
 global.fetch=async(url,opts)=>{calls++;assert.match(String(url),/salesforce-production.yml/);const b=JSON.parse(opts.body);assert.equal(b.inputs.continuation_id,d.pipeline.continuation.id);return new Response(null,{status:204});};
 try{await dispatchProduction({owner:'o',repo:'r',token:'synthetic'},{id:'w'},{id:'j'},d.pipeline);assert.equal(calls,1);await assert.rejects(()=>dispatchProduction({}, {}, {},d.pipeline),/checkpointed/);}finally{global.fetch=old;}
});
test('missing or changed approval, paused release and already claimed production block continuation',()=>{
 for(const mutate of [d=>delete d.businessApproval,d=>d.pipeline.artifactHash='changed',d=>d.paused=true,d=>d.reconciliationRequired=true,d=>d.pipeline.stages.push({name:'production'})]){const d=fixture();mutate(d);assert.throws(()=>prepareProduction(d));}
});
