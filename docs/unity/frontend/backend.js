import {canonical} from './client.js';
const fault = code => Object.assign(new Error(code), {code});
// Supply actual service endpoints and the existing authenticated browser session.
// No endpoint, auth owner, lease, or backend resolution is invented here.
export function createBackendAdapter({eventEndpoint, reconcileEndpoint, heartbeatEndpoint, interruptionEndpoint, fetchImpl = fetch, headers = () => ({}), credentials = 'include'}) {
  async function post(endpoint, payload) {
    if (!endpoint) throw fault('BACKEND_ENDPOINT_NOT_CONFIGURED');
    const response = await fetchImpl(endpoint, {method: 'POST', credentials, headers: {'Content-Type': 'application/json', ...await headers()}, body: JSON.stringify(payload)});
    if (!response.ok) throw fault(`BACKEND_HTTP_${response.status}`);
    return response.json();
  }
  return {
    sendEvent: event => post(eventEndpoint, event),
    markPending: request => post(interruptionEndpoint, request),
    reconcile: request => post(reconcileEndpoint, request),
    // Server assigns/validates ownership and fencing. Clients cannot do so.
    heartbeat: lease => post(heartbeatEndpoint, lease)
  };
}

export function createResolutionTracker({onChange = () => {}} = {}) {
  const originals = new Map(), latest = new Map(), ended = new Map(), conflicts = [];
  const key = value => `${value.sessionId}|${value.experienceId}`;
  function publish() { onChange(state()); }
  function state() { return {history: structuredClone([...originals.values()]), latest: structuredClone([...latest.values()]), conflicts: structuredClone(conflicts)}; }
  return {
    // Call only for responses from the authenticated backend adapter, never for
    // untrusted window messages or a timer pretending to be the backend.
    receive(response, expected) {
      if (response?.schemaVersion !== 1 || response.protocol !== 'career-experience-resolution' || response.type !== 'experience.reconciled' || response.producer !== 'backend' || response.policyVersion !== 'v003' || !response.resolutionId || !Number.isSafeInteger(response.revision) || response.revision < 1 || !response.resolvedAt || !response.reconcileRequestId) throw fault('INVALID_RESOLUTION');
      for (const field of ['sessionId', 'experienceId', 'roomId', 'buildId', 'scenarioId', 'scenarioVersion']) if (expected[field] !== response[field]) throw fault('RESOLUTION_ATTRIBUTION_MISMATCH');
      if (!['pending_reconciliation', 'deferred_active', 'interrupted', 'not_started', 'ended'].includes(response.lifecycleStatus)) throw fault('INVALID_LIFECYCLE');
      if (response.lifecycleStatus !== 'ended' && response.process !== null) throw fault('RESOLUTION_IS_NOT_FINAL_MEASUREMENT');
      if (response.lifecycleStatus === 'ended' && (response.unityEndReceived !== true || !response.unityEndEventId || response.source !== 'unity_end')) throw fault('MISSING_VALIDATED_UNITY_END');
      if (response.lifecycleStatus === 'interrupted' && (!response.evidence?.newStartRequested || response.evidence.oldLeaseStatus !== 'expired' || response.evidence.fenceConfirmed !== true)) throw fault('MISSING_FENCE_EVIDENCE');
      const id = `${response.resolutionId}|${response.revision}`, previous = originals.get(id);
      if (previous) { if (canonical(previous) !== canonical(response)) { conflicts.push({code: 'RESOLUTION_ID_CONFLICT', previous, incoming: structuredClone(response)}); publish(); throw fault('RESOLUTION_ID_CONFLICT'); } return state(); }
      const current = latest.get(key(response));
      if (current && current.resolutionId !== response.resolutionId) { conflicts.push({code: 'RESOLUTION_LINEAGE_CONFLICT', previous: structuredClone(current), incoming: structuredClone(response)}); publish(); throw fault('RESOLUTION_LINEAGE_CONFLICT'); }
      originals.set(id, structuredClone(response));
      // A late backend interrupted receipt cannot replace an actual Unity end.
      if ((!current || current.revision < response.revision) && !(ended.has(key(response)) && response.lifecycleStatus !== 'ended')) latest.set(key(response), structuredClone(response));
      publish(); return state();
    },
    observeUnity(event) {
      if (event?.protocol !== 'career-experience' || event.type !== 'experience.ended') return;
      ended.set(key(event), structuredClone(event)); publish();
    },
    display(sessionId, experienceId) { const id = `${sessionId}|${experienceId}`; return structuredClone(ended.get(id) || latest.get(id) || null); },
    state
  };
}

export function reconciliationRequest(previous, newExperienceId, reconcileRequestId = crypto.randomUUID()) {
  if (!newExperienceId || previous.experienceId === newExperienceId) throw fault('NEW_EXPERIENCE_ID_REQUIRED');
  return {schemaVersion: 1, protocol: 'career-experience-resolution', action: 'reconcile_experience', reconcileRequestId, sessionId: previous.sessionId, experienceId: previous.experienceId, roomId: previous.roomId, trigger: 'NEW_PLAY_START', newExperienceId};
}
