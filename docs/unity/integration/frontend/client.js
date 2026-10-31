// Version-fixed preview adapter. Unity remains the gameplay/event authority.
export const canonical = v => JSON.stringify(v, (_, x) => x && !Array.isArray(x) && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const fault = (code, message=code, extra={}) => Object.assign(new Error(message), {code,...extra});
export function createOutbox({send, storage=localStorage, key='career-preview:v001:outbox', onChange=()=>{}}) {
  let rows=JSON.parse(storage.getItem(key)||'[]'), running=false;
  const save=()=>{storage.setItem(key,JSON.stringify(rows));onChange(rows.map(({event,...r})=>r));};
  return {
    enqueue(event){const id=event.sessionId+'|'+event.eventId, body=canonical(event), old=rows.find(r=>r.id===id);if(old){if(old.body!==body)throw fault('EVENT_ID_CONFLICT');return;}rows.push({id,event,body,status:'pending',attempts:0,ack:null});save();},
    async flush(){if(running)return;running=true;try{for(const r of rows){if(r.status==='stored')continue;r.attempts++;try{const ack=await send(JSON.parse(r.body));if(ack?.sessionId!==r.event.sessionId||ack?.eventId!==r.event.eventId||ack?.stored!==true)throw fault('INVALID_STORAGE_ACK');r.ack=ack;r.status='stored';r.error=null;}catch(e){r.status='pending';r.error=String(e.message);}save();}}finally{running=false;}},
    state:()=>structuredClone(rows)
  };
}
export function createExperienceClient({frame, manifest, sessionId=crypto.randomUUID(), onEvent=()=>{}, onStatus=()=>{}, outbox, timeoutMs=5000}) {
  const targetOrigin=new URL(frame.src,location.href).origin, calls=new Map(), events=new Map(), snapshots=new Map();
  let ready=false, active=null, disposed=false;
  const status=value=>onStatus({value,sessionId,experienceId:active?.experienceId??null});
  const supported=s=>manifest.supported.some(x=>['buildId','roomId','scenarioId','scenarioVersion'].every(k=>x[k]===s[k]));
  function ingest(e){
    if(!e||e.schemaVersion!==1||e.protocol!=='career-experience'||e.sessionId!==sessionId||!active||e.experienceId!==active.experienceId||e.roomId!==active.roomId)return;
    if(e.type==='experience.error'){const c=calls.get(e.requestId);if(c){clearTimeout(c.timer);c.reject?.(fault(e.error.code,e.error.message));c.response=e;c.pending=false;if(c.request.action==='start_experience')active=null;}status(e.error.code);return;}
    if(e.buildId!==active.buildId||e.scenarioId!==active.scenarioId||e.scenarioVersion!==active.scenarioVersion||typeof e.eventId!=='string'||!Number.isSafeInteger(e.sequence)||e.sequence<1||typeof e.scenarioRunId!=='string')return;
    const id=e.sessionId+'|'+e.eventId, body=canonical(e), old=events.get(id);
    if(old){if(canonical(old)!==body)throw fault('EVENT_ID_CONFLICT',id);}else{
      const original=structuredClone(e);events.set(id,original);outbox?.enqueue(original);
      const p=e.process,key=JSON.stringify([e.sessionId,e.experienceId,e.scenarioRunId,p?.scope,...(p?.scope==='interaction'?[e.stepId,e.objectId,e.workItemId]:[])]);
      if(p&&(!snapshots.has(key)||snapshots.get(key).sequence<e.sequence))snapshots.set(key,original);
      onEvent(original);
    }
    if(e.type==='experience.ended'){
      for(const old of [...(e.data?.events||[]),...(e.data?.previousRuns||[]).flatMap(r=>r.events||[])]){if(old.type!=='experience.ended')ingest(old);}
      active.ended=structuredClone(e);status('ended_received');
    }
    const c=calls.get(e.requestId);if(c&&e.type===c.expected){clearTimeout(c.timer);c.response=structuredClone(e);c.pending=false;c.resolve?.(c.response);}
  }
  const message=e=>{if(disposed||e.source!==frame.contentWindow||e.origin!==targetOrigin)return;
    if(e.data?.channel==='career-preview'&&e.data.type==='ready'&&e.data.buildId===manifest.build.build_id){if(!ready){ready=true;clearInterval(hello);status('ready');}return;}
    if(e.data?.channel==='career-experience'){try{ingest(e.data.event);}catch(error){status(error.code||'RECEIVE_ERROR');}}
  };
  window.addEventListener('message',message);
  const handshake=()=>frame.contentWindow?.postMessage({channel:'career-preview',type:'hello'},targetOrigin);
  const hello=setInterval(handshake,300);handshake();
  function transmit(c){
    if(disposed)throw fault('DISPOSED');if(!ready)throw fault('NOT_READY');
    if(c.response){if(c.response.type==='experience.error')return Promise.reject(fault(c.response.error.code));return Promise.resolve(c.response);}
    const post=()=>{try{if(!frame.isConnected||!frame.contentWindow)throw fault('FRAME_REMOVED');frame.contentWindow.postMessage({channel:'career-preview',type:'control',request:c.request},targetOrigin);}catch{clearTimeout(c.timer);c.pending=false;status('pending_reconciliation');c.reject?.(fault('RESPONSE_UNCONFIRMED'));}};
    if(c.pending){post();return c.promise;}
    c.pending=true;c.promise=new Promise((resolve,reject)=>{c.resolve=resolve;c.reject=reject;c.timer=setTimeout(()=>{c.pending=false;status('pending_reconciliation');reject(fault('RESPONSE_UNCONFIRMED'));},timeoutMs);});
    post();return c.promise;
  }
  function issue(action,extra,requestId){
    const request={schemaVersion:1,protocol:'career-experience',requestId,action,sessionId,experienceId:active.experienceId,roomId:active.roomId,...extra};
    const old=calls.get(requestId);if(old){if(canonical(old.request)!==canonical(request))throw fault('REQUEST_ID_CONFLICT');return transmit(old);}
    const c={request,expected:action==='start_experience'?'experience.started':'experience.ended'};calls.set(requestId,c);return transmit(c);
  }
  return {
    sessionId,
    start(selection,{requestId=crypto.randomUUID(),experienceId=crypto.randomUUID()}={}){
      if(disposed)throw fault('DISPOSED');if(!ready)throw fault('NOT_READY');if(!supported(selection))throw fault('UNSUPPORTED_COMBINATION');
      if(active&&!active.ended)throw fault('EXPERIENCE_ACTIVE');
      if([...calls.values()].some(c=>c.request.experienceId===experienceId))throw fault('EXPERIENCE_ID_REUSED');
      active={...selection,experienceId,ended:null};return issue('start_experience',{scenarioId:selection.scenarioId,scenarioVersion:selection.scenarioVersion},requestId);
    },
    end({requestId=crypto.randomUUID()}={}){if(!active)throw fault('NOT_STARTED');if(active.ended&&!calls.has(requestId))throw fault('ALREADY_ENDED','이미 종료했습니다.',{originalEventId:active.ended.eventId});return issue('end_experience',{reason:'USER_REQUESTED_END'},requestId);},
    retry(requestId){const c=calls.get(requestId);if(!c)throw fault('UNKNOWN_REQUEST');return transmit(c);},
    replay(){if(!ready||disposed)throw fault('NOT_READY');frame.contentWindow.postMessage({channel:'career-preview',type:'replay'},targetOrigin);},
    state:()=>({ready,sessionId,active:structuredClone(active),events:[...events.values()],snapshots:[...snapshots.values()],requests:[...calls.values()].map(c=>({request:c.request,pending:c.pending,received:!!c.response}))}),
    dispose(){disposed=true;clearInterval(hello);window.removeEventListener('message',message);for(const c of calls.values()){clearTimeout(c.timer);if(c.pending)c.reject(fault('RESPONSE_UNCONFIRMED'));}if(active&&!active.ended)status('pending_reconciliation');}
  };
}
