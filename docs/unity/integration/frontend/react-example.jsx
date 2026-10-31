import React,{useCallback,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Experience} from './Experience.jsx';
const manifest=await fetch('../manifest.json').then(r=>r.json());
const scenarioId=new URLSearchParams(location.search).get('scenarioId')||'career-net-951-experience';
const selection=manifest.supported.find(s=>s.scenarioId===scenarioId);
if(!selection)throw Error('UNSUPPORTED_COMBINATION');
const sessionId=crypto.randomUUID();
function App(){
  const client=useRef(null),[status,setStatus]=useState('준비 중'),[result,setResult]=useState(null);
  const onClient=useCallback(c=>{client.current=c;window.reactPreview=c;},[]);
  const onEvent=useCallback(e=>{if(e.type==='experience.ended')setResult(e);},[]);
  const onStatus=useCallback(s=>setStatus(s.value),[]);
  return <main style={{fontFamily:'sans-serif'}}><h1>React 외부 호출 최소 예제</h1><p>{selection.name} · {status} · 이 예제는 수신 확인용이며 서버 전송 어댑터는 연결하지 않았습니다.</p><button onClick={()=>client.current.end().catch(e=>setStatus(e.code))}>종료 · 결과 받기</button><Experience siteUrl="../site/index.html" manifest={manifest} selection={selection} sessionId={sessionId} onEvent={onEvent} onClient={onClient} onStatus={onStatus}/>{result&&<pre>{JSON.stringify({process:result.process,result:result.result,context:result.context},null,2)}</pre>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
