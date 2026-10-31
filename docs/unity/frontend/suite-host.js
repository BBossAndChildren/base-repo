import {createExperienceClient, createOutbox, canonical} from './client.js';
import {installAudioUI} from './audio-ui.js';

const suiteAudio=installAudioUI();

const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./suite-ui.css',import.meta.url).href;document.head.append(stylesheet);
const mode = document.documentElement.dataset.mode;
const statusNode = document.getElementById('connection-status');
const setStatus = text => { if (statusNode) statusNode.textContent = text; };
const manifest = await fetch('./supported-manifest.json').then(response => { if (!response.ok) throw Error('지원 목록을 불러오지 못했습니다.'); return response.json(); });
window.careerSuiteManifest = manifest;
let parentOrigin = null;
try { const value = new URLSearchParams(location.search).get('parentOrigin'); if (value && new URL(value).origin === value && new URL(value).protocol.match(/^https?:$/)) parentOrigin = value; } catch {}
if (parentOrigin) window.careerExperienceParentOrigin = parentOrigin;
const supported = request => manifest.supported.some(row => row.buildId === manifest.build.build_id && row.roomId === request.roomId && row.scenarioId === request.scenarioId && row.scenarioVersion === request.scenarioVersion);
function control(request) {
  if (!window.officeUnity) throw Error('NOT_READY');
  if (request?.action === 'start_experience' && !supported(request)) {
    const event = {schemaVersion: 1, protocol: 'career-experience', requestId: request.requestId, sessionId: request.sessionId, experienceId: request.experienceId, roomId: request.roomId, type: 'experience.error', error: {code: 'UNSUPPORTED_COMBINATION', message: '이 빌드의 고정 ID·버전 지원 목록에 없는 조합입니다.'}};
    window.dispatchEvent(new CustomEvent('career-experience:event', {detail: event}));
    if (parentOrigin) parent.postMessage({channel: 'career-experience', event}, parentOrigin);
    return;
  }
  window.officeUnity.SendMessage('CareerProtocol', 'ReceiveControl', JSON.stringify(request));
}
// Host transport is independent of the selector. No gameplay state is changed.
window.addEventListener('message', event => {
  if (!parentOrigin || event.origin !== parentOrigin || event.source !== parent || event.data?.channel !== 'career-preview') return;
  if (event.data.type === 'hello' && window.officeUnity) parent.postMessage({channel: 'career-preview', type: 'ready', buildId: manifest.build.build_id}, parentOrigin);
  if (event.data.type === 'control' && window.officeUnity) control(event.data.request);
  if (event.data.type === 'replay' && window.officeUnity) window.officeUnity.SendMessage('CareerProtocol', 'Replay', '');
  if(event.data.type==='presentation'&&window.officeUnity){const value=event.data.presentation;if(/^#[0-9a-fA-F]{6}$/.test(value?.backgroundColor||''))window.officeUnity.SendMessage('CareerProtocol','SetPresentation',JSON.stringify({backgroundColor:value.backgroundColor.toUpperCase()}));else window.dispatchEvent(new CustomEvent('career-experience:presentation',{detail:{accepted:false,error:'INVALID_BACKGROUND_COLOR'}}));}
});

if (mode === 'integration') {
  setStatus(parentOrigin ? '외부 연결을 준비하고 있습니다.' : '외부 호스트의 연결을 기다리고 있습니다.');
  const timer = setInterval(() => { if (window.officeUnity) { setStatus(parentOrigin ? '연결 준비 완료' : '외부 호스트에서 체험을 시작해 주세요.'); clearInterval(timer); } }, 300);
} else {
  const search = document.getElementById('search'), list = document.getElementById('scenario-list');
  const start = document.getElementById('start'), end = document.getElementById('end'), detail = document.getElementById('selection-detail');
  const result = document.getElementById('result-json'), summary = document.getElementById('result-summary'), log = document.getElementById('event-log');
  const selectedLabel = document.getElementById('selected-title'), ackNode = document.getElementById('ack-status'), scenarioChoice = document.getElementById('scenario-choice');
  let selected = null, lastRequestId = null, latestResult = null, gameReady = false, rows = [], localReceiver = false;
  const outbox = createOutbox({
    key: `career-suite:${manifest.build.build_id}:outbox`,
    send: async event => {
      const response = await fetch('/__local/events', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(event)});
      if (!response.ok) throw Error('로컬 수신기 미연결 · 원본은 전송 대기 중');
      const ack = await response.json(); localReceiver = ack.producer === 'local-test-receiver'; return ack;
    },
    onChange: state => { const stored = state.rows.filter(row => row.status === 'stored').length; ackNode.textContent = `${localReceiver ? '로컬 수신기' : '저장 ACK'} ${stored} / 전송 대기 ${state.rows.length - stored}${state.persistenceError ? ' · 브라우저 보존 오류' : ''}`; }
  });
  function updateButtons() {
    const active = client.state().active, running = active && !active.ended;
    start.disabled = !gameReady || !selected?.supported || !!running;
    end.disabled = !gameReady || !running;
    document.getElementById('retry').disabled = !lastRequestId;
  }
  const labels = {ready: 'Unity 준비 완료', starting: '체험 시작 응답 대기', started_received:'체험 시작 확인 · 진행 중', ending: '종료 응답 대기', ended_received: '종료 원본 수신 완료', pending_reconciliation: '응답 미확인 · 같은 요청 재전송 또는 서버 대조 필요'};
  const client = createExperienceClient({unity: () => window.officeUnity ? {SendMessage: (_object, _method, payload) => _method === 'ReceiveControl' ? control(JSON.parse(payload)) : window.officeUnity.SendMessage(_object, _method, payload)} : null, manifest, outbox,
    onStatus: status => { if (status.isCurrent===false)return;if (status.value === 'ready') gameReady = true; setStatus(labels[status.value] || status.value); queueMicrotask(updateButtons); },
    onEvent: event => {
      const isCurrent=event.experienceId===client.state().active?.experienceId;
      if(event.type==='experience.started'&&isCurrent) {
        document.body.classList.add('focused');
        document.getElementById('focus-game').textContent='체험 목록 보기';
        document.getElementById('result-drawer').open=false;
        window.dispatchEvent(new Event('resize'));
      }
      const item = document.createElement('li'); item.textContent = `#${event.sequence} ${event.type}${event.objectId ? ' · ' + event.objectId : ''}`;
      log.prepend(item); if (log.children.length > 100) log.lastChild.remove();
      document.getElementById('event-count').textContent = String(client.state().events.length);
      if (event.type === 'experience.ended'&&isCurrent) {
        latestResult = event; result.textContent = JSON.stringify(event, null, 2);
        const outcome = {completed: '업무 완료', aborted: '체험 중도 종료', failed: '최종 실패'}[event.result.outcome] || event.result.outcome;
        summary.textContent = `${outcome} · 제출 ${event.process.attemptCount ?? '미측정'}회 · 실수 ${event.process.mistakeCount ?? '미측정'}회 · ${event.context.assessmentCode || '평가 미확정'}`;
        document.getElementById('result-drawer').open = true; updateButtons();
      }
    }
  });
  window.careerSuite = {client, outbox, manifest};
  try { const response = await fetch('./target-registry.json'); const catalog = response.ok ? await response.json() : {}; rows = catalog.targets || catalog.scenarios || catalog.items || []; } catch {}
  const normalized = rows.map(row => ({...row, scenarioId: row.scenarioId || row.scenario_id, scenarioVersion: row.scenarioVersion || row.scenario_version || row.version, roomId: row.roomId || row.room_id || row.panorama_ref?.image_id, occupationId: row.occupationId || row.occupation_id, name: row.occupationName || row.occupation_name || row.name || row.title || row.scenarioId || row.scenario_id}));
  for (const supportedRow of manifest.supported) {
    const match = normalized.find(row => ['scenarioId', 'scenarioVersion', 'roomId'].every(key => row[key] === supportedRow[key]));
    if (match) Object.assign(match, supportedRow, {supported: true}); else normalized.push({...supportedRow, name: supportedRow.name || supportedRow.occupationName || supportedRow.scenarioId, supported: true});
  }
  rows = normalized.sort((a, b) => Number(!!b.supported) - Number(!!a.supported) || a.name.localeCompare(b.name, 'ko'));
  const rooms = [...new Set(rows.map(row => row.roomId).filter(Boolean))].sort();
  document.getElementById('catalog-count').textContent = `공간 ${rooms.length} · 시나리오/공간 조합 ${rows.length} · 실행 지원 ${rows.filter(row => row.supported).length}`;
  function select(row) {
    selected = row; selectedLabel.textContent = row.name; latestResult = null;
    const issues = row.blockers || row.review_issues || row.remaining_issues || [];
    detail.textContent = `${row.occupationId || '직업 ID 확인 필요'}\n${row.roomId || '공간 선택 미정'} · ${row.scenarioId} @ ${row.scenarioVersion}\n${row.supported ? '이 빌드의 실행 대상 · 전체 실행 검수와 구별됩니다.' : '현재 실행 미지원 · ' + (row.implementation_status || row.status || '구현/주제/전문 검토 대기')}\n${Array.isArray(issues) ? issues.map(issue => typeof issue === 'string' ? issue : JSON.stringify(issue)).join('\n') : String(issues)}`;
    const inRoom = rows.filter(candidate => candidate.roomId === row.roomId);
    scenarioChoice.replaceChildren();
    for (const candidate of inRoom) { const option = document.createElement('option'); option.value = String(rows.indexOf(candidate)); option.textContent = `${candidate.name} · ${candidate.supported ? '실행 지원' : '대기/미지원'}`; option.selected = candidate === row; scenarioChoice.append(option); }
    renderList(); updateButtons();
  }
  function renderList() {
    const query = search.value.trim().toLocaleLowerCase(), filtered = rows.filter(row => `${row.name} ${row.roomName || ''} ${row.roomId} ${row.scenarioId} ${row.occupationId}`.toLocaleLowerCase().includes(query));
    list.replaceChildren();
    const visibleRooms = [...new Set(filtered.map(row => row.roomId || '공간 미정'))].sort();
    for (const room of visibleRooms) {
      const candidates = filtered.filter(row => (row.roomId || '공간 미정') === room), row = candidates.find(candidate => candidate.supported) || candidates[0];
      const isSelected = selected?.roomId === row.roomId, button = document.createElement('button'); button.className = 'scenario' + (isSelected ? ' selected' : ''); button.type = 'button'; button.setAttribute('aria-pressed', String(isSelected));
      const title = document.createElement('strong'); title.textContent = row.roomName || room;
      const metadata = document.createElement('span'); metadata.textContent = `${row.name} · ${candidates.filter(candidate => candidate.supported).length ? '실행 지원' : '대기/미지원'}`;
      const count = document.createElement('span'); count.textContent = `${room} · 직업/대안 ${rows.filter(candidate => candidate.roomId === row.roomId).length}개`;
      button.append(title, metadata, count); button.onclick = () => select(row); list.append(button);
    }
    document.getElementById('search-count').textContent = `${visibleRooms.length}개 공간 · ${filtered.length}개 체험 검색 결과`;
  }
  async function invoke(action) { try { await action(); } catch (error) { setStatus(error.code || error.message); } finally { updateButtons(); } }
  start.onclick = () => invoke(async () => { lastRequestId = crypto.randomUUID(); await client.start(selected, {requestId: lastRequestId}); document.getElementById('unity-canvas').focus(); });
  end.onclick = () => invoke(() => { lastRequestId = crypto.randomUUID(); return client.end({requestId: lastRequestId}); });
  document.getElementById('retry').onclick = () => invoke(() => client.retry(lastRequestId));
  document.getElementById('replay').onclick = () => invoke(() => client.replay());
  document.getElementById('flush').onclick = () => outbox.flush();
  const raw = () => JSON.stringify({schema_version: 3, protocol: 'career-experience', protocolVersion: 'v002', final: latestResult, events: client.state().events, sequenceGaps: client.sequenceGaps(), conflicts: client.state().conflicts}, null, 2);
  document.getElementById('copy').onclick = () => invoke(async () => { await navigator.clipboard.writeText(raw()); setStatus('원본 JSON 복사 완료'); });
  document.getElementById('download').onclick = () => { const link = document.createElement('a'), url = URL.createObjectURL(new Blob([raw()], {type: 'application/json'})); link.href = url; link.download = `career-events-${client.sessionId}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  search.oninput = renderList;
  scenarioChoice.onchange = () => select(rows[Number(scenarioChoice.value)]);
  renderList(); if (rows.length) select(rows.find(row => row.roomId === rooms[0] && row.supported) || rows.find(row => row.roomId === rooms[0]) || rows[0]);
  setInterval(() => outbox.flush(), 3000);
  window.addEventListener('pagehide', () => { const state = client.state(); if (state.active && !state.active.ended) { try { localStorage.setItem('career-suite:pending', canonical({lifecycleStatus: 'pending_reconciliation', sessionId: state.sessionId, selection: state.active, lastObserved: state.events.at(-1) || null})); } catch {} } });
}
