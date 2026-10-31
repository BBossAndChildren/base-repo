import type { CareerEvent, ExperienceResolution, StorageAck } from '../types/unity'
import { requestRaw } from './client'

/** 3D 연동 API (03 1-4 · 1-8 · 1-9 · 1-10). 응답을 감싸지 않는다 */
export interface ExperienceApi {
  /** 1-4 Unity 이벤트 원본 저장. DB 저장 후에만 stored: true */
  sendEvent(playId: string, event: CareerEvent): Promise<StorageAck>
  /** 1-8 종료 응답 없는 이전 체험 정산 */
  reconcile(playId: string, request: ReconcileRequest): Promise<ExperienceResolution>
  /** 1-9 체험 중 생존 신호 */
  heartbeat(playId: string, ids: { sessionId: string; experienceId: string }): Promise<{ leaseExpiresAt: string }>
  /** 1-10 종료 응답 미수신 기록 */
  markPending(playId: string, body: { sessionId: string; experienceId: string; roomId: string; requestId: string; reason: 'END_RESPONSE_TIMEOUT' }): Promise<unknown>
}

/** contracts/reconciliation-v003/reconcile-request.example.json 의 request */
export interface ReconcileRequest {
  schemaVersion: 1
  protocol: 'career-experience-resolution'
  action: 'reconcile_experience'
  reconcileRequestId: string
  sessionId: string
  experienceId: string
  roomId: string
  trigger: 'NEW_PLAY_START'
  newExperienceId: string
}

const play = (playId: string) => `/api/v1/plays/${encodeURIComponent(playId)}`

export const httpExperienceApi: ExperienceApi = {
  sendEvent: (playId, event) => requestRaw('POST', `${play(playId)}/experience-events`, { body: event }),
  reconcile: (playId, body) => requestRaw('POST', `${play(playId)}/experience-reconcile`, { body }),
  heartbeat: (playId, body) => requestRaw('POST', `${play(playId)}/experience-heartbeat`, { body }),
  markPending: (playId, body) => requestRaw('POST', `${play(playId)}/experience-pending`, { body }),
}
