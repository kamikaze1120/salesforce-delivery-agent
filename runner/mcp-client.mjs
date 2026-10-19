import {spawn} from 'node:child_process';
import {mcpMode,deliveryTools,reconciliationTools} from './mcp-policy.mjs';
import readline from 'node:readline';
export class SalesforceMcp {
  constructor(env){
    this.mode=mcpMode(env.DELIVERY_MCP_MODE);
    this.next=0;this.pending=new Map();
    this.process=spawn(process.execPath,['runner/mcp-server.mjs'],{env,stdio:['pipe','pipe','inherit']});
    this.process.on('exit',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Salesforce MCP server exited.'));}this.pending.clear();});
    readline.createInterface({input:this.process.stdout}).on('line',line=>{try{const r=JSON.parse(line),p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result);}catch{}});
  }
  request(method,params={},timeout=90000){return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('MCP request timed out; reconcile writes before retrying.'));},timeout);this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
  async initialize(){await this.request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'delivery-studio-runner',version:'0.4.0'}});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');const result=await this.request('tools/list');const expected=this.mode==='reconciliation'?reconciliationTools:deliveryTools;if(!Array.isArray(result.tools)||expected.some(n=>!result.tools.some(t=>t.name===n)))throw new Error('Required Salesforce MCP tool unavailable.');if(this.mode==='reconciliation'&&(result.tools.length!==expected.length||result.tools.some(t=>!expected.includes(t.name))))throw new Error('Reconciliation server exposed unexpected tools.');}
  async call(name,args={}){if(this.mode==='reconciliation'&&!reconciliationTools.includes(name))throw new Error('Reconciliation cannot execute this tool.');const result=await this.request('tools/call',{name,arguments:args},name==='run_apex_tests'?3700000:90000);if(result.isError)throw new Error('Salesforce MCP tool failed.');return JSON.parse(result.content.find(c=>c.type==='text').text);}
  close(){this.process.kill();}
}
