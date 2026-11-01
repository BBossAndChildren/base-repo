import { beforeEach, expect, it } from 'vitest'
import { ensurePlayerId } from '../api'
import { clearPlayerId } from '../api/player'
import { mockControl, mockGameApi as api } from './mockGameApi'
import { mockExperienceApi, mockExperienceStore } from './mockExperienceApi'
import type { CareerEvent } from '../types/unity'

beforeEach(() => { mockControl.reset(); mockControl.setDelay(0); mockExperienceStore.reset(); clearPlayerId() })

async function offer() {
  await ensurePlayerId(api)
  const play = await api.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
  const turn = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '체험 할래' })
  return { play, turn }
}

it('같은 미시작 제안은 재개하고 거절 ACK와 재시도 뒤에는 복원하지 않는다', async () => {
  const { play, turn } = await offer()
  expect((await api.getPlay(play.playId)).experience).toEqual(turn.experience)
  const body = { sessionId: play.sessionId, offerId: turn.turnId }
  expect(await api.dismissExperienceOffer(play.playId, body)).toEqual(await api.dismissExperienceOffer(play.playId, body))
  expect((await api.getPlay(play.playId)).experience).toBeNull()
  expect((await api.getPlay(play.playId)).experienceState?.lifecycleStatus).toBe('declined')
  await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '다음 이야기' })
  await expect(api.dismissExperienceOffer(play.playId, body)).rejects.toMatchObject({ type: 'NOT_FOUND' })
})

it('다른 세션의 거절은 거부하며 뒤 채팅은 이전 제안을 복원하지 않는다', async () => {
  const { play, turn } = await offer()
  await expect(api.dismissExperienceOffer(play.playId, { sessionId: 'wrong', offerId: turn.turnId })).rejects.toMatchObject({ type: 'INVALID_INPUT' })
  expect((await api.getPlay(play.playId)).experience).not.toBeNull()
  await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '그냥 이야기하자' })
  expect((await api.getPlay(play.playId)).experience).toBeNull()
})

it('관측한 체험과 실제 종료 결과는 미시작 카드로 복원하지 않고 새 같은 시나리오 제안과 구별한다', async () => {
  const { play, turn } = await offer()
  const { buildId, roomId, scenarioId, scenarioVersion } = turn.experience!
  const event: CareerEvent = { buildId, roomId, scenarioId, scenarioVersion, schemaVersion: 1, protocol: 'career-experience', eventId: 'start', sequence: 0, sessionId: play.sessionId, experienceId: 'observed', requestId: null, type: 'experience.started', result: { outcome: 'pending', success: null, completionCode: null, data: {} } }
  await mockExperienceApi.sendEvent(play.playId, event)
  expect((await api.getPlay(play.playId)).experience).toBeNull()
  await expect(api.dismissExperienceOffer(play.playId, { sessionId: play.sessionId, offerId: turn.turnId })).rejects.toMatchObject({ type: 'STATE_CONFLICT' })
  const ended: CareerEvent = { ...event, eventId: 'end', sequence: 1, type: 'experience.ended', result: { ...event.result, outcome: 'completed' } }
  await mockExperienceApi.sendEvent(play.playId, ended)
  expect((await api.getPlay(play.playId)).experienceState).toMatchObject({ lifecycleStatus: 'ended', outcome: 'completed', experienceId: 'observed' })
  const next = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '다른 체험' })
  await mockExperienceApi.sendEvent(play.playId, ended)
  expect((await api.getPlay(play.playId)).experience?.offerId).toBe(next.turnId)
})
