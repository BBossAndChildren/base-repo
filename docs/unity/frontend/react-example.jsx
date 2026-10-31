import React, {useCallback, useRef, useState} from 'react';
import {Experience} from './Experience.jsx';
import {createOutbox} from './client.js';
import {createBackendAdapter,createResolutionTracker,reconciliationRequest} from './backend.js';

// The real service supplies these URLs, authentication and a reviewed allowlist.
export function CareerPage({siteUrl,manifest,selection,sessionId,endpoints}) {
  const client = useRef(null), [status,setStatus] = useState('로딩 중'), [result,setResult] = useState(null);
  const backend = useRef(createBackendAdapter(endpoints)).current;
  const resolutions = useRef(createResolutionTracker()).current;
  const outbox = useRef(createOutbox({send: event => backend.sendEvent(event)})).current;
  const onClient = useCallback(value => {client.current=value;}, []);
  const onStatus = useCallback(value => {if(value.isCurrent!==false)setStatus(value.value);}, []);
  const onEvent = useCallback(event => {resolutions.observeUnity(event);outbox.flush();if(event.type==='experience.ended'&&event.experienceId===client.current?.state().active?.experienceId)setResult(event);}, [resolutions,outbox]);
  async function call(action) {try{await action();}catch(error){setStatus(error.code||error.message);}}
  async function explicitNewPlay(previous) {
    const newExperienceId=crypto.randomUUID();
    if(previous && !previous.ended) {
      const response=await backend.reconcile(reconciliationRequest({...previous,sessionId},newExperienceId));
      resolutions.receive(response,{...previous,sessionId});
      // The server owns admission/fencing. Recreate/reconnect the Unity frame
      // only after its actual ownership/admission contract permits a new play.
      if(!['ended','interrupted','not_started'].includes(response.lifecycleStatus))throw Error(response.lifecycleStatus);
      throw Error('서버의 새 실행 승인·기존 Unity 연결 교체 절차를 연결해 주세요.');
    }
    return client.current.start(selection,{experienceId:newExperienceId});
  }
  return <main><p role="status">{status}</p><button onClick={()=>call(()=>explicitNewPlay(client.current.state().active))}>선택한 체험 시작</button><button onClick={()=>call(()=>client.current.end())}>체험 종료 · 결과 받기</button><Experience {...{siteUrl,manifest,sessionId,outbox,onEvent,onStatus,onClient}}/>{result&&<pre>{JSON.stringify(result,null,2)}</pre>}</main>;
}
