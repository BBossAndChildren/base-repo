import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../api'
import { clearPlayerId, setPlayerId } from '../api/player'
import type { StartPlayRequest } from '../types/api'
import { mockControl, mockGameApi as api } from './mockGameApi'

const START: StartPlayRequest = { name: '민준', age: 15, situation: '중학생', hasDreamJob: false }

async function startGame() {
  await ensurePlayerId(api)
  return api.startPlay(START)
}

describe('mockGameApi', () => {
  beforeEach(() => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
  })

  it('게스트 발급 후 보관하고, 다시 부르면 같은 ID', async () => {
    const first = await ensurePlayerId(api)
    const second = await ensurePlayerId(api)
    expect(first).toBe(second)
  })

  it('게임 시작은 playId · sessionId · 나이 · 첫 메시지를 준다', async () => {
    const play = await startGame()
    expect(play.playId).toBeTruthy()
    expect(play.sessionId).toBeTruthy()
    expect(play.state.age).toBe(15)
    expect(play.messages.length).toBeGreaterThan(0)
  })

  it.each([
    ['이름 없음', { ...START, name: ' ' }],
    ['희망 직업 있음인데 직업명 없음', { ...START, hasDreamJob: true }],
    ['나이가 정수가 아님', { ...START, age: 15.5 }],
  ])('필수 값 누락이면 INVALID_INPUT (%s)', async (_label, body) => {
    await ensurePlayerId(api)
    await expect(api.startPlay(body)).rejects.toMatchObject({ type: 'INVALID_INPUT' })
  })

  it('발급한 게스트는 새로고침(모듈 다시 불러오기) 뒤에도 기억해 401 이 나지 않는다', async () => {
    const playerId = await ensurePlayerId(api)
    vi.resetModules()
    const reloaded = await import('./mockGameApi')
    reloaded.mockControl.setDelay(0)
    setPlayerId(playerId)
    await expect(reloaded.mockGameApi.startPlay(START)).resolves.toMatchObject({ playId: expect.any(String) })
  })

  it('채팅은 requestId 가 필수이고, 같은 ID · 같은 문장은 저장한 응답을, 다른 문장은 REQUEST_CONFLICT', async () => {
    const play = await startGame()
    await expect(api.sendTurn(play.playId, { message: '안녕' } as never)).rejects.toMatchObject({ type: 'INVALID_INPUT' })
    const requestId = crypto.randomUUID()
    const first = await api.sendTurn(play.playId, { requestId, message: '안녕' })
    const again = await api.sendTurn(play.playId, { requestId, message: '안녕' })
    expect(again.turnId).toBe(first.turnId)
    expect(first.state?.age).toBe(15)
    expect(first.stateVersion).toBeGreaterThan(0)
    await expect(api.sendTurn(play.playId, { requestId, message: '다른 말' })).rejects.toMatchObject({ type: 'REQUEST_CONFLICT' })
  })

  it('모르는 게스트면 UNKNOWN_PLAYER', async () => {
    setPlayerId('not-registered')
    await expect(api.startPlay(START)).rejects.toMatchObject({ type: 'UNKNOWN_PLAYER' })
  })

  it('다른 사람의 플레이는 NOT_FOUND', async () => {
    const play = await startGame()
    clearPlayerId()
    await ensurePlayerId(api)
    await expect(api.getPlay(play.playId)).rejects.toMatchObject({ type: 'NOT_FOUND' })
  })

  it('채팅은 메시지 · 힌트를 주고 재개하면 대화가 이어진다', async () => {
    const play = await startGame()
    const turn = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '안녕' })
    expect(turn.messages.length).toBeGreaterThan(0)
    expect(turn.experience).toBeNull()
    const resumed = await api.getPlay(play.playId)
    expect(resumed.messages).toContainEqual({ role: 'user', speaker: '민준', text: '안녕' })
    expect(resumed.sessionId).toBe(play.sessionId)
    expect(turn.messages.every((m) => m.role !== 'user')).toBe(true)
  })

  it('세 턴마다 나이 · 에너지 변화가 stateChanges 로 온다', async () => {
    const play = await startGame()
    await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '1' })
    await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '2' })
    const third = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '3' })
    expect(play.state).toMatchObject({ funds: 50, energy: 70 })
    expect(third.stateChanges).toEqual([
      { field: 'age', from: 15, to: 16 },
      { field: 'energy', from: 70, to: 65 },
    ])
  })

  it('"체험" 이면 3D 체험 분기를 준다', async () => {
    const play = await startGame()
    const turn = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '축제 체험 해 볼래' })
    expect(turn.experience).toMatchObject({ roomId: 'PAN-002', scenarioId: 'career-net-951-experience', jobs: ['행사기획자'] })
    expect(turn.experience?.title).toBeTruthy()
  })

  it('"없는체험" 이면 체험 없이 notice 를 준다', async () => {
    const play = await startGame()
    const turn = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '없는체험' })
    expect(turn.experience).toBeNull()
    expect(turn.notice?.type).toBe('EXPERIENCE_SKIPPED')
  })

  it('빈 메시지는 INVALID_INPUT, "오류" · "느려" 는 서버 오류 흉내', async () => {
    const play = await startGame()
    await expect(api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '  ' })).rejects.toMatchObject({ type: 'INVALID_INPUT' })
    await expect(api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '오류' })).rejects.toMatchObject({ type: 'AI_UNAVAILABLE' })
    await expect(api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '느려' })).rejects.toMatchObject({ type: 'TIMEOUT' })
  })

  it('"끝" 이면 인생이 끝나고, 이후 채팅은 ALREADY_ENDED, 결말을 받을 수 있다', async () => {
    const play = await startGame()
    await expect(api.getResult(play.playId)).rejects.toMatchObject({ type: 'NOT_ENDED', message: '아직 이야기가 끝나지 않았어요.' })
    const last = await api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '이제 끝' })
    expect(last.ended).toBe(true)
    await expect(api.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '더' })).rejects.toMatchObject({ type: 'ALREADY_ENDED' })
    const result = await api.getResult(play.playId)
    expect(result.recommendedJobs).toHaveLength(3)
    expect(result.recommendedJobs.some((job) => job.isNew)).toBe(true)
    expect(result.recommendedJobs.every((job) => job.basis.length > 0)).toBe(true)
  })

  it('지난 기록은 내 플레이만 보여 준다', async () => {
    await startGame()
    await api.startPlay(START)
    const mine = await api.listMyPlays()
    clearPlayerId()
    await ensurePlayerId(api)
    const other = await api.listMyPlays()
    expect(mine.plays).toHaveLength(2)
    expect(other.plays).toHaveLength(0)
  })
})
