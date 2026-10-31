// Existing catalog audio only. This module never synthesizes or generates sound.
const clone=value=>structuredClone(value);
const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const scopeKey=scope=>scope?JSON.stringify(['sessionId','experienceId','scenarioRunId','scenarioId','scenarioVersion','roomId'].map(key=>scope[key]??null)):null;
const signature=cue=>JSON.stringify([cue.scope, cue.kind, cue.operation, cue.clipKey, cue.loopId]);
export function createAudioController({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,fetchImpl=globalThis.fetch,storage=globalThis.localStorage,storageKey='career-suite:audio:v001',now=()=>performance.now(),onChange=()=>{},maxVoices=4,maxLoops=2,baseUrl=globalThis.location?.href||'http://localhost/'}={}) {
  let prefs={enabled:true,volume:.55};
  try{const old=JSON.parse(storage?.getItem(storageKey)||'null');if(old){prefs.enabled=old.enabled!==false;prefs.volume=clamp(old.volume,0,1,.55);}}catch{}
  let context=null,unlocked=false,disposed=false,hidden=false,paused=false,epoch=0,activeScope=null,manifest=null,status='loading',lastError=null,serial=0;
  const assets=new Map(),decoded=new Map(),active=new Map(),pendingLoops=new Map(),loopGenerations=new Map(),seen=new Map(),cooldowns=new Map(),retiredScopes=new Set(),listeners=new Set(),history=[];
  const counts={requested:0,started:0,ended:0,cancelled:0,duplicate:0,droppedLocked:0,droppedCooldown:0,droppedBudget:0,missing:0,stale:0,errors:0};
  const state=()=>({supported:!!AudioContext,unlocked,enabled:prefs.enabled,volume:prefs.volume,hidden,paused,status,lastError,activeScope,available:new Set(assets.values()).size,pending:manifest?.pending?.length||0,pendingAssets:clone(manifest?.pending||[]),active:[...active.values()].map(row=>({id:row.id,key:row.asset.key,loopId:row.loopId,loop:row.loop,priority:row.priority})),counts:{...counts},history:clone(history),assets:[...new Set(assets.values())].map(asset=>({...asset}))});
  function emit(){const value=state();onChange(value);for(const listener of listeners)listener(value);}
  function note(code,details={}){history.push({code,at:now(),...details});if(history.length>64)history.shift();}
  function persist(){try{storage?.setItem(storageKey,JSON.stringify(prefs));}catch(error){note('PREFERENCE_STORAGE_UNAVAILABLE',{message:String(error.message)});}}
  function mix(){const duck=[...active.values()].some(row=>!row.loop&&row.priority>=60);for(const row of active.values())row.gain.gain.value=prefs.volume*row.asset.gain*(duck&&row.loop ? .4 : 1);}
  function stopRow(row,reason){if(!active.has(row.id))return;active.delete(row.id);counts.cancelled++;try{row.source.onended=null;row.source.stop();row.source.disconnect();row.gain.disconnect();}catch{}note('STOP',{key:row.asset.key,reason});}
  function cancel(reason='cancel'){epoch++;pendingLoops.clear();for(const row of [...active.values()])stopRow(row,reason);status=prefs.enabled?'ready':'muted';mix();emit();}
  function stopLoop(id){loopGenerations.set(id,(loopGenerations.get(id)||0)+1);pendingLoops.delete(id);for(const row of [...active.values()])if(row.loopId===id)stopRow(row,'loop_stop');mix();emit();}
  function fail(code,error){lastError={code,message:String(error?.message||error||code)};counts.errors++;status=code==='AUTOPLAY_BLOCKED'?'gesture-required':'error';if(code==='AUTOPLAY_BLOCKED')unlocked=false;note(code);emit();}
  async function unlock(event){
    if(disposed||event?.isTrusted!==true||!['pointerdown','keydown','click','touchend'].includes(event.type))return false;
    if(!AudioContext){status='unavailable';emit();return false;}
    if(unlocked&&context?.state==='running')return true;
    try{context=context||new AudioContext();await context.resume();if(disposed)return false;unlocked=context.state==='running';status=!prefs.enabled?'muted':unlocked?'ready':'gesture-required';lastError=null;emit();return unlocked;}catch(error){if(!disposed)fail('AUTOPLAY_BLOCKED',error);return false;}
  }
  function configure(value,url=baseUrl){
    if(disposed)return;
    if(value?.schema_version!==3||!Array.isArray(value.assets))throw new Error('INVALID_AUDIO_MANIFEST');
    cancel('manifest_change');assets.clear();decoded.clear();manifest=clone(value);baseUrl=url;
    for(const item of value.assets){
      if(!item.id||!item.key||!item.src)continue;
      const target=new URL(item.src,url);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)continue;
      const asset={...item,src:target.href,gain:clamp(item.gain,0,1,1),cooldownMs:clamp(item.cooldownMs??item.cooldown,0,10000,90),loop:item.loop===true};assets.set(item.key,asset);assets.set(item.id,asset);
    }
    status=!AudioContext?'unavailable':!prefs.enabled?'muted':unlocked?'ready':'gesture-required';lastError=null;emit();
  }
  async function buffer(asset){
    if(decoded.has(asset.key))return decoded.get(asset.key);
    const promise=(async()=>{const response=await fetchImpl(asset.src,{credentials:'same-origin'});if(!response.ok)throw new Error('AUDIO_HTTP_'+response.status);const data=await response.arrayBuffer();return context.decodeAudioData(data);})();
    decoded.set(asset.key,promise);try{return await promise;}catch(error){decoded.delete(asset.key);throw error;}
  }
  function makeSpace(loop,priority){
    const loops=[...active.values()].filter(row=>row.loop).sort((a,b)=>a.priority-b.priority||a.startedAt-b.startedAt);
    if(loop&&loops.length>=maxLoops){if(loops[0].priority>priority)return false;stopRow(loops[0],'loop_budget');}
    if(active.size>=maxVoices){const oldest=[...active.values()].sort((a,b)=>a.priority-b.priority||a.startedAt-b.startedAt)[0];if(oldest.priority>priority)return false;stopRow(oldest,'voice_budget');}
    return true;
  }
  async function play(asset,cue,preview=false,notification=false){
    if(disposed)return false;
    counts.requested++;
    if(!prefs.enabled||hidden||(paused&&!notification)){note('SUPPRESSED_STATE',{key:asset.key});return false;}
    if(!unlocked||!context||context.state!=='running'){counts.droppedLocked++;status='gesture-required';emit();return false;}
    const loop=!preview&&cue.operation==='loop_start',loopId=loop?(cue.loopId||asset.key):null;
    if(loop&&!asset.loop){note('LOOP_NOT_AUTHORIZED',{key:asset.key});return false;}
    if(loop&&(pendingLoops.has(loopId)||[...active.values()].some(row=>row.loopId===loopId))){counts.duplicate++;emit();return false;}
    const time=now();if(!preview&&time-(cooldowns.get(asset.key)??-Infinity)<asset.cooldownMs){counts.droppedCooldown++;emit();return false;}
    cooldowns.set(asset.key,time);const generation=epoch,loopGeneration=loopGenerations.get(loopId)||0,scope=activeScope,pendingToken={};
    if(loop)pendingLoops.set(loopId,pendingToken);status='loading-audio';emit();
    let createdRow=null;
    try{
      const audio=await buffer(asset);
      if(disposed||generation!==epoch||scope!==activeScope||hidden||(paused&&!notification)||!prefs.enabled||(loop&&(loopGenerations.get(loopId)||0)!==loopGeneration)){counts.stale++;note('STALE_DECODE_DISCARDED',{key:asset.key});return false;}
      const priority=clamp(cue.priority??asset.priority,0,100,loop?10:30);
      if(!makeSpace(loop,priority)){counts.droppedBudget++;return false;}
      const source=context.createBufferSource(),gain=context.createGain(),id='audio-'+(++serial);
      source.buffer=audio;source.loop=loop;source.connect(gain);gain.connect(context.destination);
      const row={id,asset,source,gain,loopId,loop,priority,startedAt:now()};createdRow=row;active.set(id,row);mix();
      source.onended=()=>{if(!active.has(id))return;active.delete(id);counts.ended++;try{source.disconnect();gain.disconnect();}catch{}mix();status=active.size?'playing':'ready';emit();};
      source.start();counts.started++;status='playing';lastError=null;note('PLAY',{key:asset.key,loop,scope});emit();return true;
    }catch(error){if(createdRow)stopRow(createdRow,'start_failed');if(generation===epoch&&!disposed)fail(error?.name==='NotAllowedError'?'AUTOPLAY_BLOCKED':'AUDIO_LOAD_OR_DECODE_FAILED',error);return false;}
    finally{if(loop&&pendingLoops.get(loopId)===pendingToken)pendingLoops.delete(loopId);if(!disposed&&generation===epoch&&status==='loading-audio'){status=active.size?'playing':'ready';emit();}}
  }
  function cue(input){
    if(disposed||!input?.cueId||!input.kind)return Promise.resolve(false);
    const operation=input.operation||(input.cancel?'cancel':'play'),value={...input,operation};
    const prior=seen.get(input.cueId),body=signature(value);
    if(prior){if(prior!==body){note('CUE_ID_CONFLICT',{cueId:input.cueId});counts.errors++;}else counts.duplicate++;emit();return Promise.resolve(false);}
    seen.set(input.cueId,body);
    const key=scopeKey(input.scope);
    if(key&&retiredScopes.has(key)){counts.stale++;note('RETIRED_SCOPE_CUE',{cueId:input.cueId});emit();return Promise.resolve(false);}
    if(key&&key!==activeScope){
      if(activeScope&&!['start','experience.started','scenario.started'].includes(input.kind)){counts.stale++;note('FOREIGN_SCOPE_CUE',{cueId:input.cueId});emit();return Promise.resolve(false);}
      if(activeScope)retiredScopes.add(activeScope);cancel('scope_change');activeScope=key;paused=false;
    }
    if(operation==='cancel'){
      cancel(input.kind);if(input.kind==='pause')paused=true;else if(['resume','start','scenario.started','experience.started'].includes(input.kind))paused=false;
      if(['ended','reset'].includes(input.kind)){if(activeScope)retiredScopes.add(activeScope);activeScope=null;paused=false;}
      emit();const notification=assets.get(input.clipKey);return notification?play(notification,{...value,operation:'play'},false,true):Promise.resolve(true);
    }
    if(input.kind==='resume')paused=false;
    if(operation==='loop_stop'){stopLoop(input.loopId||input.clipKey);return Promise.resolve(true);}
    const asset=assets.get(input.clipKey);
    if(!asset){counts.missing++;note('CLIP_NOT_AVAILABLE',{key:input.clipKey||null});emit();return Promise.resolve(false);}
    return play(asset,value);
  }
  return {
    state,configure,cue,cancel,unlock,
    subscribe(listener){listeners.add(listener);listener(state());return()=>listeners.delete(listener);},
    setEnabled(value){prefs.enabled=!!value;persist();cancel(prefs.enabled?'enabled':'muted');status=prefs.enabled?(unlocked?'ready':'gesture-required'):'muted';emit();},
    setVolume(value){prefs.volume=clamp(value,0,1,.55);persist();mix();emit();},
    setHidden(value){hidden=!!value;if(hidden)cancel('page_hidden');emit();},
    async preview(key,event){await unlock(event);const asset=assets.get(key);if(!asset)return false;return play(asset,{operation:'play',priority:50},true);},
    dispose(){if(disposed)return;cancel('dispose');disposed=true;listeners.clear();decoded.clear();try{context?.close()?.catch(()=>{});}catch{}status='disposed';}
  };
}
