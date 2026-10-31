// 3D 연동 API mock (03 1-4 · 1-8 · 1-9 · 1-10). 메모리에만 저장한다
import { ApiError } from '../api/errors'
import type { ExperienceApi } from '../api/experienceApi'
import { canonicalJson } from '../lib/experience/canonical'
import type { CareerEvent } from '../types/unity'

const events = new Map<string, string>()
const ended = new Set<string>()
const pending = new Set<string>()

export const mockExperienceStore = {
  reset() {
    events.clear()
    ended.clear()
    pending.clear()
  },
  /** 테스트 확인용 */
  eventCount: () => events.size,
  hasEnded: (experienceId: string) => ended.has(experienceId),
  isPending: (experienceId: string) => pending.has(experienceId),
}

export const mockExperienceApi: ExperienceApi = {
  async sendEvent(_playId, event: CareerEvent) {
    const key = `${event.sessionId}|${event.eventId}`
    const body = canonicalJson(event)
    const old = events.get(key)
    if (old !== undefined && old !== body) throw new ApiError(409, 'UNKNOWN', '같은 이벤트 ID 에 다른 내용이에요.')
    events.set(key, body)
    if (event.type === 'experience.ended') {
      ended.add(event.experienceId)
      pending.delete(event.experienceId)
    }
    return { stored: true, sessionId: event.sessionId, eventId: event.eventId }
  },
  async reconcile(_playId, request) {
    const lifecycleStatus = ended.has(request.experienceId) ? 'ended' : 'interrupted'
    pending.delete(request.experienceId)
    return { type: 'experience.reconciled', experienceId: request.experienceId, lifecycleStatus }
  },
  async heartbeat() {
    return { leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() }
  },
  async markPending(_playId, body) {
    pending.add(body.experienceId)
    return { sessionId: body.sessionId, experienceId: body.experienceId, lifecycleStatus: 'pending_reconciliation' }
  },
}
