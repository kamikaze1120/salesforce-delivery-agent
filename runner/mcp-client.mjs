import {spawn} from 'node:child_process';
import readline from 'node:readline';
export class SalesforceMcp {
  constructor(env){
    this.next=0;this.pending=new Map();
    this.process=spawn(process.execPath,['runner/mcp-server.mjs'],{env,stdio:['pipe','pipe','inherit']});
    this.process.on('exit',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Salesforce MCP server exited.'));}this.pending.clear();});
    readline.createInterface({input:this.process.stdout}).on('line',line=>{try{const r=JSON.parse(line),p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result);}catch{}});
  }
  request(method,params={},timeout=90000){return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('MCP request timed out; reconcile writes before retrying.'));},timeout);this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
  async initialize(){await this.request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'delivery-studio-runner',version:'0.4.0'}});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');const result=await this.request('tools/list');for(const n of ['inspect_org','validate_metadata','deploy_metadata','deployment_status','run_apex_tests'])if(!result.tools.some(t=>t.name===n))throw new Error('Required Salesforce MCP tool unavailable.');}
  async call(name,args={}){const result=await this.request('tools/call',{name,arguments:args},name==='run_apex_tests'?3700000:90000);if(result.isError)throw new Error('Salesforce MCP tool failed.');return JSON.parse(result.content.find(c=>c.type==='text').text);}
  close(){this.process.kill();}
}
