import {createAudioController} from './audio.js';

export function installAudioUI({manifestUrl=new URL('../audio/audio-manifest.json',import.meta.url),testMode=document.documentElement.dataset.mode==='test'}={}) {
  const controller=createAudioController();window.careerAudio=controller;
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./audio-ui.css',import.meta.url).href;document.head.append(stylesheet);
  const panel=document.createElement('details');panel.id='career-audio';
  const summary=document.createElement('summary');summary.textContent='효과음 · 준비 중';
  const body=document.createElement('div');body.className='audio-settings';
  const status=document.createElement('p');status.className='audio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const enable=document.createElement('button');enable.type='button';enable.textContent='효과음 활성화';enable.onclick=event=>controller.unlock(event);
  const muteLabel=document.createElement('label'),mute=document.createElement('input');mute.type='checkbox';mute.setAttribute('aria-label','효과음 음소거');muteLabel.append(mute,document.createTextNode(' 음소거'));mute.onchange=()=>controller.setEnabled(!mute.checked);
  const volumeLabel=document.createElement('label');volumeLabel.className='audio-volume';volumeLabel.textContent='볼륨';
  const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='100';volume.step='1';volume.setAttribute('aria-label','효과음 볼륨');const volumeValue=document.createElement('output');volumeLabel.append(volume,volumeValue);volume.oninput=()=>controller.setVolume(Number(volume.value)/100);
  const stop=document.createElement('button');stop.type='button';stop.textContent='재생 중인 소리 정지';stop.onclick=()=>controller.cancel('user_stop');
  body.append(status,enable,muteLabel,volumeLabel,stop);panel.append(summary,body);document.body.append(panel);
  let gallery=null,galleryVersion='';
  if(testMode){gallery=document.createElement('details');gallery.className='audio-gallery';const title=document.createElement('summary');title.textContent='효과음 목록 · 미리듣기';gallery.append(title);body.append(gallery);}
  const labels={'loading':'효과음 자료를 준비하고 있습니다.','gesture-required':'게임 화면을 한 번 눌러 효과음을 활성화해 주세요. 외부 화면의 시작 클릭만으로는 브라우저가 재생을 허용하지 않을 수 있습니다.','ready':'효과음을 사용할 수 있습니다.','loading-audio':'효과음을 불러오는 중입니다.','playing':'효과음 재생 중','muted':'효과음이 음소거되어 있습니다.','unavailable':'이 브라우저에서 오디오를 사용할 수 없습니다. 게임 조작은 계속할 수 있습니다.','error':'효과음을 재생하지 못했습니다. 게임 조작은 계속할 수 있습니다.','disposed':'효과음 재생을 종료했습니다.'};
  const unsubscribe=controller.subscribe(state=>{
    summary.textContent='효과음 · '+(!state.enabled?'음소거':state.unlocked?'켜짐':'활성화 필요');
    status.textContent=labels[state.status]||state.status;mute.checked=!state.enabled;volume.value=String(Math.round(state.volume*100));volumeValue.value=Math.round(state.volume*100)+'%';
    enable.hidden=state.unlocked||!state.supported;stop.disabled=!state.active.length;
    if(gallery){const version=state.assets.map(asset=>asset.key).join('|')+'|'+state.pending;if(galleryVersion!==version){galleryVersion=version;gallery.querySelectorAll('.audio-item,.audio-inventory').forEach(node=>node.remove());const inventory=document.createElement('p');inventory.className='audio-inventory';inventory.textContent=`재생 자료 ${state.available}개 · 준비되지 않은 항목 ${state.pending}개`;gallery.append(inventory);for(const asset of state.assets){const button=document.createElement('button');button.type='button';button.className='audio-item';button.textContent=`${asset.id} · ${asset.name||asset.key}${asset.loop?' · 반복 원본':''}`;button.onclick=event=>controller.preview(asset.key,event);gallery.append(button);}for(const asset of state.pendingAssets){const row=document.createElement('p');row.className='audio-item';row.textContent=`${asset.id||asset.candidateId||''} · ${asset.name||asset.key||''} · 재생 자료 없음`;gallery.append(row);}}}
  });
  const audioEvent=event=>controller.cue(event.detail);
  const gesture=event=>{if(event.type==='keydown'&&['Shift','Alt','Control','Meta','Tab'].includes(event.key))return;controller.unlock(event);};
  const visibility=()=>controller.setHidden(document.hidden);
  const unload=()=>dispose();let disposed=false;
  function dispose(){if(disposed)return;disposed=true;window.removeEventListener('career-experience:audio',audioEvent);document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',unload);unsubscribe();controller.dispose();panel.remove();}
  window.addEventListener('career-experience:audio',audioEvent);document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',unload);
  visibility();
  fetch(manifestUrl).then(response=>{if(!response.ok)throw new Error('AUDIO_MANIFEST_HTTP_'+response.status);return response.json();}).then(manifest=>{if(!disposed)controller.configure(manifest,manifestUrl.href);}).catch(error=>{if(!disposed){status.textContent='기존 효과음 자료가 아직 연결되지 않았습니다. 게임 조작은 계속할 수 있습니다.';summary.textContent='효과음 · 자료 연결 대기';panel.dataset.error=error.message;}});
  return {controller,dispose};
}
