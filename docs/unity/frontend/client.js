// Shared test/React adapter. Unity owns gameplay, counts and immutable events.
export const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const copy = value => structuredClone(value);
const fault = (code, message = code, extra = {}) => Object.assign(new Error(message), {code, ...extra});
const identity = event => `${event.sessionId}|${event.eventId}`;
const fields = ['buildId', 'roomId', 'scenarioId', 'scenarioVersion'];
export function createOutbox({send, storage = globalThis.localStorage, key = 'career-suite:v002:outbox', onChange = () => {}}) {
  let rows = [], running = null, persistenceError = null;
  try { rows = JSON.parse(storage?.getItem(key) || '[]'); if (!Array.isArray(rows)) throw Error('INVALID_OUTBOX'); }
  catch (error) { persistenceError = String(error.message); rows = []; }
  function save() {
    // ACKed originals remain in the live client/server. Persist lightweight ACK
    // references so completed sessions do not exhaust browser storage forever.
    const durable = rows.map(row => row.status === 'stored' ? {id: row.id, status: 'stored', attempts: row.attempts, ack: row.ack, storedReference: true} : row);
    try { storage?.setItem(key, JSON.stringify(durable)); persistenceError = null; } catch (error) { persistenceError = String(error.message); }
    onChange({rows: copy(rows), persistenceError});
  }
  return {
    enqueue(event) {
      const id = identity(event), body = canonical(event), old = rows.find(row => row.id === id);
      if (old) {
        if (old.body) { if (old.body !== body) throw fault('EVENT_ID_CONFLICT', id); return; }
        // After reload an ACK reference has no original body to compare. Send
        // the incoming original again; the backend validates duplicate/conflict.
        Object.assign(old, {event: JSON.parse(body), body, status: 'pending', storedReference: false}); save(); return;
      }
      rows.push({id, event: JSON.parse(body), body, status: 'pending', attempts: 0, ack: null}); save();
    },
    flush() {
      if (running) return running;
      running = (async () => {
        for (const row of rows) {
          if (row.status === 'stored') continue;
          row.attempts++;
          try {
            const ack = await send(JSON.parse(row.body));
            if (ack?.sessionId !== row.event.sessionId || ack?.eventId !== row.event.eventId || ack?.stored !== true) throw fault('INVALID_STORAGE_ACK');
            row.ack = copy(ack); row.status = 'stored'; row.error = null;
          } catch (error) { row.status = 'pending'; row.error = String(error.message); }
          save();
        }
      })().finally(() => { running = null; });
      return running;
    },
    state: () => ({rows: copy(rows), persistenceError})
  };
}

export function createExperienceClient({frame = null, unity = null, manifest, sessionId = crypto.randomUUID(), onEvent = () => {}, onStatus = () => {}, outbox, timeoutMs = 5000}) {
  if ((!frame && !unity) || (frame && unity)) throw fault('ONE_TRANSPORT_REQUIRED');
  if (!manifest?.build?.build_id || !Array.isArray(manifest.supported)) throw fault('INVALID_MANIFEST');
  const targetOrigin = frame ? new URL(frame.src, location.href).origin : null;
  const calls = new Map(), events = new Map(), snapshots = new Map(), experiences = new Map(), sequences = new Map(), conflicts = [], postTerminalEvents=[];
  let ready = false, active = null, disposed = false, presentation=null;
  const status = (value, extra = {}) => onStatus({value, sessionId, experienceId: active?.experienceId ?? null, ...extra});
  const supported = selection => selection?.buildId === manifest.build.build_id && manifest.supported.some(row => fields.every(key => row[key] === selection[key]));
  const snapshotKey=event=>JSON.stringify([sessionId,event.experienceId,event.scenarioRunId,event.process.scope,...(event.process.scope==='interaction'?[event.stepId,event.objectId,event.workItemId]:[])]);
  const reportConflict = (code, original, incoming) => { conflicts.push({code, original: copy(original), incoming: copy(incoming)}); status(code); };
  function ingest(event, embedded = false) {
    if (!event || event.schemaVersion !== 1 || event.protocol !== 'career-experience' || event.sessionId !== sessionId) return;
    const experience = experiences.get(event.experienceId);
    if (!experience || event.roomId !== experience.roomId) return;
    if (event.type === 'experience.error') {
      const call = calls.get(event.requestId);
      if (!call || call.request.experienceId !== event.experienceId) return;
      clearTimeout(call.timer); call.pending = false; call.response = copy(event); call.reject?.(fault(event.error?.code || 'CONTROL_ERROR', event.error?.message));
      if (call.request.action === 'start_experience' && active === experience && !experience.started) active = null;
      status(event.error?.code || 'CONTROL_ERROR', {receivedExperienceId:event.experienceId,isCurrent:active===experience}); return;
    }
    if (!fields.every(key => event[key] === experience[key]) || !event.eventId || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || !event.scenarioRunId || !event.occurredAt || !event.process || !event.result || !event.context) return;
    const id = identity(event), old = events.get(id);
    if (old) { if (canonical(old) !== canonical(event)) reportConflict('EVENT_ID_CONFLICT', old, event); return; }
    const priorSequence = sequences.get(event.sequence);
    if (priorSequence && priorSequence !== id) { reportConflict('SEQUENCE_CONFLICT', events.get(priorSequence), event); return; }
    const original = copy(event); events.set(id, original); sequences.set(event.sequence, id);
    try { outbox?.enqueue(original); } catch (error) { status(error.code || 'OUTBOX_ERROR'); }
    // Preserve anomalous late legacy emissions as originals, but a closed
    // experience cannot become pending again merely because it has a new seq.
    if(experience.ended&&event.sequence>experience.ended.sequence&&event.type!=='experience.ended') {
      postTerminalEvents.push(original);onEvent(copy(original));return;
    }
    const process = event.process, key = snapshotKey(event);
    // Snapshots replace by sequence; cumulative counts are never added.
    if (!snapshots.has(key) || snapshots.get(key).sequence < event.sequence) snapshots.set(key, original);
    if (event.type === 'experience.started') { experience.started = original; status('started_received', {receivedExperienceId:event.experienceId,isCurrent:active===experience}); }
    if (event.type === 'experience.ended') {
      if (experience.ended && experience.ended.eventId !== event.eventId) { reportConflict('MULTIPLE_END_EVENTS', experience.ended, event); return; }
      experience.ended = original;
      // An end can arrive after a higher-sequence legacy post-end emission.
      // Rebuild only affected snapshots from originals at/before the real end.
      for(const late of events.values())if(late.experienceId===event.experienceId&&late.sequence>event.sequence&&late.type!=='experience.ended'&&!postTerminalEvents.some(item=>item.eventId===late.eventId))postTerminalEvents.push(late);
      for(const [scopeKey,snapshot]of snapshots)if(snapshot.experienceId===event.experienceId&&snapshot.sequence>event.sequence){
        const prior=[...events.values()].filter(item=>item.experienceId===event.experienceId&&item.sequence<=event.sequence&&snapshotKey(item)===scopeKey).sort((a,b)=>b.sequence-a.sequence)[0];
        if(prior)snapshots.set(scopeKey,prior);else snapshots.delete(scopeKey);
      }
      snapshots.set(key,original);
      if (!embedded) for (const previous of [...(Array.isArray(event.data?.events) ? event.data.events : []), ...(event.data?.previousRuns || []).flatMap(run => Array.isArray(run.events) ? run.events : [])]) {
        if (previous?.type !== 'experience.ended') ingest(previous, true);
      }
      status('ended_received', {receivedExperienceId: event.experienceId, isCurrent: active === experience});
    }
    onEvent(copy(original));
    const call = calls.get(event.requestId);
    if (call && call.request.experienceId === event.experienceId && event.type === call.expected) {
      clearTimeout(call.timer); call.response = original; call.pending = false; call.resolve?.(copy(original));
    }
  }
  function sendPresentation(){if(!ready||!presentation)return;if(frame)frame.contentWindow.postMessage({channel:'career-preview',type:'presentation',presentation},targetOrigin);else unity().SendMessage('CareerProtocol','SetPresentation',JSON.stringify(presentation));}
  function setReady() { if (!ready) { ready = true; clearInterval(hello);sendPresentation(); status('ready'); } }
  const local = event => { if (!frame && !disposed) ingest(event.detail); };
  const message = event => {
    if (disposed || !frame || event.source !== frame.contentWindow || event.origin !== targetOrigin) return;
    if (event.data?.channel === 'career-preview' && event.data.type === 'ready' && event.data.buildId === manifest.build.build_id) setReady();
    if (event.data?.channel === 'career-experience') ingest(event.data.event);
  };
  // Always install listeners before checking readiness or sending controls.
  window.addEventListener('message', message); window.addEventListener('career-experience:event', local);
  function handshake() {
    if (disposed) return;
    if (frame) frame.contentWindow?.postMessage({channel: 'career-preview', type: 'hello'}, targetOrigin);
    else if (unity()) setReady();
  }
  const hello = setInterval(handshake, 300); queueMicrotask(handshake);
  function sendControl(request) {
    if (frame) {
      if (!frame.isConnected || !frame.contentWindow) throw fault('FRAME_REMOVED');
      frame.contentWindow.postMessage({channel: 'career-preview', type: 'control', request}, targetOrigin);
    } else unity().SendMessage('CareerProtocol', 'ReceiveControl', JSON.stringify(request));
  }
  function transmit(call) {
    if (disposed) throw fault('DISPOSED'); if (!ready) throw fault('NOT_READY');
    if (call.response) return call.response.type === 'experience.error' ? Promise.reject(fault(call.response.error.code, call.response.error.message)) : Promise.resolve(copy(call.response));
    const post = () => { try { sendControl(call.request); } catch (error) { clearTimeout(call.timer); call.pending = false; status('pending_reconciliation'); call.reject?.(fault('RESPONSE_UNCONFIRMED', error.message)); } };
    if (call.pending) { post(); return call.promise; }
    call.pending = true;
    call.promise = new Promise((resolve, reject) => {
      call.resolve = resolve; call.reject = reject;
      call.timer = setTimeout(() => { call.pending = false; status('pending_reconciliation', {requestId: call.request.requestId}); reject(fault('RESPONSE_UNCONFIRMED')); }, timeoutMs);
    });
    status(call.request.action === 'start_experience' ? 'starting' : 'ending'); post(); return call.promise;
  }
  function issue(action, extra, requestId) {
    const request = {schemaVersion: 1, protocol: 'career-experience', requestId, action, sessionId, experienceId: active.experienceId, roomId: active.roomId, ...extra};
    const old = calls.get(requestId);
    if (old) { if (canonical(old.request) !== canonical(request)) throw fault('REQUEST_ID_CONFLICT'); return transmit(old); }
    const call = {request, expected: action === 'start_experience' ? 'experience.started' : 'experience.ended'}; calls.set(requestId, call); return transmit(call);
  }
  return {
    sessionId,
    setPresentation(value){if(disposed)throw fault('DISPOSED');if(!/^#[0-9a-fA-F]{6}$/.test(value?.backgroundColor||''))throw fault('INVALID_BACKGROUND_COLOR');presentation={backgroundColor:value.backgroundColor.toUpperCase()};sendPresentation();return copy(presentation);},
    start(selection, {requestId = crypto.randomUUID(), experienceId = crypto.randomUUID()} = {}) {
      if (disposed) throw fault('DISPOSED'); if (!ready) throw fault('NOT_READY'); if (!supported(selection)) throw fault('UNSUPPORTED_COMBINATION');
      if (active && !active.ended) throw fault('EXPERIENCE_ACTIVE'); if (experiences.has(experienceId)) throw fault('EXPERIENCE_ID_REUSED');
      if (calls.has(requestId)) throw fault('REQUEST_ID_CONFLICT');
      active = {...copy(selection), experienceId, started: null, ended: null}; experiences.set(experienceId, active);
      return issue('start_experience', {scenarioId: selection.scenarioId, scenarioVersion: selection.scenarioVersion}, requestId);
    },
    end({requestId = crypto.randomUUID()} = {}) {
      if (!active) throw fault('NOT_STARTED'); if (active.ended && !calls.has(requestId)) throw fault('ALREADY_ENDED', '이미 종료했습니다.', {originalEventId: active.ended.eventId});
      return issue('end_experience', {reason: 'USER_REQUESTED_END'}, requestId);
    },
    retry(requestId) { const call = calls.get(requestId); if (!call) throw fault('UNKNOWN_REQUEST'); return transmit(call); },
    replay() {
      if (!ready || disposed) throw fault('NOT_READY');
      if (frame) frame.contentWindow.postMessage({channel: 'career-preview', type: 'replay'}, targetOrigin); else unity().SendMessage('CareerProtocol', 'Replay', '');
    },
    state: () => ({ready, sessionId, active: copy(active), experiences: copy([...experiences.values()]), events: copy([...events.values()].sort((a, b) => a.sequence - b.sequence)), snapshots: copy([...snapshots.values()]), conflicts: copy(conflicts),postTerminalEvents:copy(postTerminalEvents), requests: [...calls.values()].map(call => ({request: copy(call.request), pending: call.pending, received: !!call.response}))}),
    sequenceGaps() { const sorted = [...sequences.keys()].sort((a, b) => a - b), gaps = []; for (let index = 1; index < sorted.length; index++) if (sorted[index] > sorted[index - 1] + 1) gaps.push([sorted[index - 1] + 1, sorted[index] - 1]); return gaps; },
    dispose() {
      disposed = true; clearInterval(hello); window.removeEventListener('message', message); window.removeEventListener('career-experience:event', local);
      for (const call of calls.values()) { clearTimeout(call.timer); if (call.pending) call.reject(fault('RESPONSE_UNCONFIRMED')); }
      if (active && !active.ended) status('pending_reconciliation');
    }
  };
}
