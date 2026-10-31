import React,{useEffect,useRef} from 'react';
import {createExperienceClient} from './client.js';
// The external service owns selection and sessionId. StrictMode cleanup detaches listeners.
export function Experience({siteUrl,manifest,selection,sessionId,outbox,onEvent,onClient,onStatus}){
  const frame=useRef(null);
  useEffect(()=>{
    let started=false;
    const client=createExperienceClient({frame:frame.current,manifest,sessionId,outbox,onEvent,onStatus:s=>{onStatus?.(s);if(s.value==='ready'&&!started){started=true;client.start(selection).catch(e=>onStatus?.({value:e.code}));}}});
    onClient?.(client);return ()=>client.dispose();
  },[siteUrl,manifest,selection,sessionId,outbox,onEvent,onClient,onStatus]);
  const url=new URL(siteUrl,location.href);url.searchParams.set('parentOrigin',location.origin);
  return <iframe ref={frame} src={url.href} title="직업 체험" style={{width:'100%',height:'80vh',border:0}}/>;
}
