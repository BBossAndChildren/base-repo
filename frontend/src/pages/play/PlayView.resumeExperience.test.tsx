import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../../api'
import { ApiError } from '../../api/errors'
import { clearPlayerId } from '../../api/player'
import { PlayerContext } from '../../app/playerContext'
import { ToastProvider } from '../../components'
import { setPendingExperience } from '../../lib/pendingExperience'
import type { ExperienceExit } from './experienceMessages'
import { mockControl, mockGameApi } from '../../mocks/mockGameApi'
import type { PlayResume } from '../../types/api'
import { PlayView } from './PlayView'

vi.mock('./ExperienceOverlay', () => ({ ExperienceOverlay: ({ onClose }: { onClose: (exit: ExperienceExit) => void }) => <button onClick={() => onClose('skipped')}>체험 준비 건너뛰기</button> }))

const OFFER = { offerId: '11111111-1111-4111-8111-111111111111', buildId: 'build', buildUrl: 'https://build.example.test/', roomId: 'PAN-002', scenarioId: 'scenario', scenarioVersion: 'v1', title: '저장된 체험', jobs: ['행사기획자'], reason: '저장된 추천 이유' }
const OFFERED = { offerId: OFFER.offerId, lifecycleStatus: 'offered', experienceId: null, outcome: null }

async function setup(map: (play: PlayResume) => PlayResume = (play) => ({ ...play, experience: OFFER, experienceState: OFFERED }), externalStart = true) {
  await ensurePlayerId(mockGameApi)
  const started = await mockGameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
  const play = map(await mockGameApi.getPlay(started.playId))
  const onStart = vi.fn()
  const user = userEvent.setup()
  render(<PlayerContext.Provider value={{ playerId: 'p', resetPlayer: vi.fn() }}><ToastProvider><MemoryRouter><PlayView play={play} onStartExperience={externalStart ? onStart : undefined} /></MemoryRouter></ToastProvider></PlayerContext.Provider>)
  return { play, user, onStart }
}

const log = () => screen.getByRole('list', { name: '대화' })

describe('서버가 확인한 재개 체험 카드', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockControl.reset()
    mockControl.setDelay(0)
    clearPlayerId()
    localStorage.clear()
  })

  it('미시작 제안을 같은 카드로 복원하되 사용자가 누르기 전에는 시작하지 않는다', async () => {
    const { user, onStart } = await setup()
    const card = within(log()).getByRole('listitem', { name: OFFER.title })
    expect(card).toHaveTextContent(OFFER.reason)
    expect(onStart).not.toHaveBeenCalled()
    await user.click(within(card).getByRole('button', { name: '체험 시작' }))
    expect(onStart).toHaveBeenCalledWith(OFFER)
  })

  it('상태 충돌 뒤 최신 서버 제안을 한 번 복원하고 입력은 유지한다', async () => {
    const { play, user } = await setup((play) => play)
    vi.spyOn(mockGameApi, 'sendTurn').mockRejectedValueOnce(new ApiError(409, 'STATE_CONFLICT'))
    vi.spyOn(mockGameApi, 'getPlay').mockResolvedValueOnce({ ...play, experience: OFFER, experienceState: OFFERED })
    const input = screen.getByLabelText('하고 싶은 말이나 행동')
    await user.type(input, '상황을 알려줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await waitFor(() => expect(within(log()).getAllByRole('listitem', { name: OFFER.title })).toHaveLength(1))
    expect(input).toHaveValue('상황을 알려줘')
  })

  it.each(['started', 'pending_reconciliation', 'ended', 'interrupted', 'declined', 'unavailable'])('%s 상태를 미시작 카드나 완료 발언으로 만들지 않는다', async (lifecycleStatus) => {
    await setup((play) => ({ ...play, experience: OFFER, experienceState: { ...OFFERED, lifecycleStatus, experienceId: 'known-experience', outcome: lifecycleStatus === 'ended' ? 'completed' : null } }))
    expect(within(log()).queryByRole('listitem', { name: OFFER.title })).not.toBeInTheDocument()
    expect(within(log()).queryByText('체험을 마쳤어요')).not.toBeInTheDocument()
  })

  it('다른 원본 턴/상태의 제안은 복원하지 않는다', async () => {
    await setup((play) => ({ ...play, experience: OFFER, experienceState: { ...OFFERED, offerId: 'different-turn' } }))
    expect(within(log()).queryByRole('listitem', { name: OFFER.title })).not.toBeInTheDocument()
  })

  it.each(['same', 'other-offer', 'other-play', 'other-session', 'legacy'] as const)('로컬 미확인 기록 %s: 정확히 같은 제안만 복원을 막는다', async (kind) => {
    await setup((play) => {
      setPendingExperience({ playId: kind === 'other-play' ? 'other' : play.playId, sessionId: kind === 'other-session' ? 'other' : play.sessionId, experienceId: 'pending', roomId: OFFER.roomId, offerId: kind === 'legacy' ? undefined : kind === 'other-offer' ? 'other' : OFFER.offerId })
      return { ...play, experience: OFFER, experienceState: OFFERED }
    })
    expect(within(log()).queryAllByRole('listitem', { name: OFFER.title })).toHaveLength(kind === 'same' ? 0 : 1)
  })

  it('거절 저장 실패에는 카드를 보존하고 재시도 ACK 뒤에만 접는다', async () => {
    const { play, user } = await setup()
    const send = vi.spyOn(mockGameApi, 'sendTurn')
    const dismiss = vi.spyOn(mockGameApi, 'dismissExperienceOffer').mockRejectedValueOnce(new ApiError(0, 'NETWORK')).mockResolvedValueOnce({ offerId: OFFER.offerId, lifecycleStatus: 'declined' })
    await user.click(within(log()).getByRole('button', { name: '다음에 할게요' }))
    await screen.findByRole('alert')
    expect(within(log()).getByRole('button', { name: '체험 시작' })).toBeEnabled()
    expect(dismiss).toHaveBeenLastCalledWith(play.playId, { sessionId: play.sessionId, offerId: OFFER.offerId })
    await user.click(within(log()).getByRole('button', { name: '다음에 할게요' }))
    await waitFor(() => expect(within(log()).queryByRole('button', { name: '체험 시작' })).not.toBeInTheDocument())
    expect(send).not.toHaveBeenCalled()
  })

  it('거절 ACK 대기에는 버튼을 잠그고 다른 제안의 ACK로 접지 않는다', async () => {
    const { user } = await setup()
    let resolve!: (value: { offerId: string; lifecycleStatus: 'declined' }) => void
    vi.spyOn(mockGameApi, 'dismissExperienceOffer').mockReturnValueOnce(new Promise((done) => { resolve = done }))
    await user.click(within(log()).getByRole('button', { name: '다음에 할게요' }))
    expect(within(log()).getByRole('button', { name: '체험 시작' })).toBeDisabled()
    expect(screen.getByLabelText('하고 싶은 말이나 행동')).toBeDisabled()
    resolve({ offerId: 'wrong-offer', lifecycleStatus: 'declined' })
    await screen.findByRole('alert')
    expect(within(log()).getByRole('button', { name: '체험 시작' })).toBeEnabled()
  })

  it('시작 전 건너뛰기 저장이 실패해도 원래 카드를 다시 선택할 수 있다', async () => {
    const { user } = await setup(undefined, false)
    vi.spyOn(mockGameApi, 'dismissExperienceOffer').mockRejectedValueOnce(new ApiError(0, 'NETWORK'))
    await user.click(within(log()).getByRole('button', { name: '체험 시작' }))
    await user.click(screen.getByRole('button', { name: '체험 준비 건너뛰기' }))
    await screen.findByRole('alert')
    expect(within(log()).getByRole('button', { name: '체험 시작' })).toBeEnabled()
    expect(within(log()).queryByText('체험을 마쳤어요')).not.toBeInTheDocument()
  })

  it('offerId가 없는 이전 응답은 거절 API 없이 기존처럼 접는다', async () => {
    const { user } = await setup((play) => ({ ...play, experience: { ...OFFER, offerId: undefined } }))
    const dismiss = vi.spyOn(mockGameApi, 'dismissExperienceOffer')
    await user.click(within(log()).getByRole('button', { name: '다음에 할게요' }))
    expect(within(log()).queryByRole('button', { name: '체험 시작' })).not.toBeInTheDocument()
    expect(dismiss).not.toHaveBeenCalled()
  })

})
