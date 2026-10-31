// Local-only example server; not a production auth/lease/reconciliation service.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical} from './client.js';
const argument=process.argv.indexOf('--root'); const root=argument>=0?path.resolve(process.argv[argument+1]):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const store=path.join(root,'local-receiver-data');fs.mkdirSync(store,{recursive:true});
const logfile=path.join(store,'events.jsonl'), seen=new Map(), latest=new Map(), ended=new Map();
function scope(e){return JSON.stringify([e.sessionId,e.experienceId,e.scenarioRunId,e.process?.scope,...(e.process?.scope==='interaction'?[e.stepId,e.objectId,e.workItemId]:[])]);}
function remember(e){seen.set(e.sessionId+'|'+e.eventId,canonical(e));const experience=e.sessionId+'|'+e.experienceId,terminal=ended.get(experience);if(terminal&&e.sequence>terminal.sequence&&e.type!=='experience.ended')return;if(e.type==='experience.ended'){ended.set(experience,e);const affected=[...latest].filter(([,row])=>row.sessionId===e.sessionId&&row.experienceId===e.experienceId&&row.sequence>e.sequence);for(const [k]of affected)latest.delete(k);if(affected.length)for(const body of seen.values()){const prior=JSON.parse(body);if(prior.sessionId!==e.sessionId||prior.experienceId!==e.experienceId||prior.sequence>e.sequence)continue;const k=scope(prior);if(!latest.has(k)||latest.get(k).sequence<prior.sequence)latest.set(k,prior);}}const k=scope(e);if(e.type==='experience.ended'||!latest.has(k)||latest.get(k).sequence<e.sequence)latest.set(k,e);}
if(fs.existsSync(logfile))for(const line of fs.readFileSync(logfile,'utf8').split('\n').filter(Boolean))remember(JSON.parse(line));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css','.png':'image/png'};
http.createServer(async(req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){res.writeHead(302,{Location:(fs.existsSync(path.join(root,'index.html'))?'/index.html':'/site/index.html')+url.search});res.end();return;}
  if(url.pathname==='/__local/events'&&req.method==='POST'){
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20_000_000){reply(413,{error:'TOO_LARGE'});return;}}
      const e=JSON.parse(raw);if(e.schemaVersion!==1||e.protocol!=='career-experience'||!e.sessionId||!e.eventId||!Number.isSafeInteger(e.sequence)||e.sequence<1)return reply(400,{error:'INVALID_EVENT'});
      const key=e.sessionId+'|'+e.eventId,body=canonical(e),old=seen.get(key);if(old&&old!==body){const fd=fs.openSync(path.join(store,'conflicts.jsonl'),'a');try{fs.writeFileSync(fd,JSON.stringify({code:'EVENT_ID_CONFLICT',original:JSON.parse(old),incoming:e,observedAt:new Date().toISOString()})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return reply(409,{error:'EVENT_ID_CONFLICT'});}
      if(!old){const fd=fs.openSync(logfile,'a');try{fs.writeFileSync(fd,JSON.stringify(e)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}remember(e);}
      return reply(200,{sessionId:e.sessionId,eventId:e.eventId,stored:true,duplicate:!!old,producer:'local-test-receiver',storage:'fsynced-jsonl'});
    }catch(e){return reply(400,{error:e.message});}
  }
  if(url.pathname==='/__local/status')return reply(200,{producer:'local-test-receiver',count:seen.size,latest:[...latest.values()]});
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,{error:'METHOD'});
  try{const pathname=decodeURIComponent(url.pathname==='/'?'/site/index.html':url.pathname);const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)||file.startsWith(store+path.sep))return reply(403,{error:'FORBIDDEN'});
    const actual=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
    res.writeHead(200,{'Content-Type':mime[path.extname(actual)]||'application/octet-stream','Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(actual).pipe(res);
  }catch{reply(404,{error:'NOT_FOUND'});}
}).listen(Number(process.env.PORT||8194),'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+(process.env.PORT||8194)+'/'));

