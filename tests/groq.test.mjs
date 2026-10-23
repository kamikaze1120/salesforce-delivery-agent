import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanConfig,publicConfig} from '../lib/core.mjs';
import {model,verifyModel} from '../lib/integrations.mjs';
const config=cleanConfig('llm',{provider:'groq',model:'openai/gpt-oss-120b',token:'synthetic-key',endpoint:'https://untrusted.example'});
test('Groq fixes its endpoint and hides credentials in public configuration',()=>{
  assert.equal(config.endpoint,'https://api.groq.com');
  assert.equal(publicConfig('llm',config).token,undefined);
  assert.throws(()=>cleanConfig('llm',{...config,provider:'untrusted'}));
});
test('Groq synthetic verification uses its API, bearer credential, model and JSON mode',async()=>{
  const old=global.fetch;
  global.fetch=async(url,opts)=>{
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(opts.headers.Authorization,'Bearer synthetic-key');
    assert.equal(opts.redirect,'error');
    const body=JSON.parse(opts.body);
    assert.equal(body.model,config.model);
    assert.equal(body.response_format.type,'json_object');
    assert.deepEqual(JSON.parse(body.messages[1].content),{connectionTest:true});
    return Response.json({choices:[{message:{content:'{"connectionTest":"ok"}'},finish_reason:'stop'}]});
  };
  try{assert.match((await verifyModel(config)).message,/verified/);}finally{global.fetch=old;}
});
test('Groq rejects throttling, malformed JSON and truncated output without exposing provider bodies',async()=>{
  const old=global.fetch;
  try{
    global.fetch=async()=>new Response('sensitive-provider-body',{status:429});
    await assert.rejects(model(config,'JSON only',{}),e=>e.message.includes('429')&&!e.message.includes('sensitive'));
    for(const [content,finish_reason] of [['not-json','stop'],['{}','length']]){
      global.fetch=async()=>Response.json({choices:[{message:{content},finish_reason}]});
      await assert.rejects(model(config,'JSON only',{}));
    }
  }finally{global.fetch=old;}
});
