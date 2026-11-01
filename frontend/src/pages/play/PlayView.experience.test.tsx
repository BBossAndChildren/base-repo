import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../../api'
import { clearPlayerId } from '../../api/player'
import { PlayerContext } from '../../app/playerContext'
import { ToastProvider } from '../../components'
import { getPendingExperience, setPendingExperience } from '../../lib/pendingExperience'
import { mockControl, mockGameApi } from '../../mocks/mockGameApi'
import type { ExperienceExit } from './experienceMessages'
import { PlayView } from './PlayView'

vi.mock('./ExperienceOverlay', () => ({
  ExperienceOverlay: ({ onClose }: { onClose: (exit: ExperienceExit) => void }) => (
    <div role="dialog" aria-label="체험 테스트">
      {(['completed', 'aborted', 'failed', 'pending', 'error', 'skipped'] as const).map((exit) => (
        <button key={exit} onClick={() => onClose(exit)}>{exit}</button>
      ))}
    </div>
  ),
}))

const OLD_HINT = '이 3D 체험을 시작하고 싶어'
const REFLECTION_EXAMPLE = '방금 체험한 내용에 대해 이야기하고 싶어'

async function setup() {
  await ensurePlayerId(mockGameApi)
  const started = await mockGameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
  const play = await mockGameApi.getPlay(started.playId)
  const sendTurn = mockGameApi.sendTurn.bind(mockGameApi)
  const send = vi.spyOn(mockGameApi, 'sendTurn').mockImplementation(async (...args) => {
    const response = await sendTurn(...args)
    return { ...response, hints: response.experience ? [OLD_HINT] : ['새로운 활동을 알아보고 싶어'] }
  })
  const user = userEvent.setup()
  render(
    <PlayerContext.Provider value={{ playerId: 'p', resetPlayer: vi.fn() }}>
      <ToastProvider>
        <MemoryRouter><PlayView play={play} /></MemoryRouter>
      </ToastProvider>
    </PlayerContext.Provider>,
  )
  const input = screen.getByLabelText('하고 싶은 말이나 행동')
  const say = async (text: string) => {
    await user.clear(input)
    await user.type(input, text)
    await user.click(screen.getByRole('button', { name: '보내기' }))
  }
  await say('체험 할래')
  await screen.findByRole('button', { name: OLD_HINT })
  return { user, input, say, send, play }
}

describe('체험에서 이야기로 복귀', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockControl.reset()
    mockControl.setDelay(0)
    localStorage.clear()
    clearPlayerId()
  })

  it.each(['completed', 'aborted', 'failed', 'pending', 'error', 'skipped'] as const)('%s 복귀 시 이전 힌트를 버리고 완료 때만 회고 입력 예시를 보여 준다', async (exit) => {
    const { user, input, send, play } = await setup()
    const pending = { playId: play.playId, sessionId: play.sessionId, experienceId: 'pending-experience', roomId: 'PAN-002' }
    if (exit === 'pending') setPendingExperience(pending)
    await user.click(screen.getByRole('button', { name: '체험 시작' }))
    await user.click(within(screen.getByRole('dialog', { name: '체험 테스트' })).getByRole('button', { name: exit }))
    expect(screen.queryByRole('button', { name: OLD_HINT })).not.toBeInTheDocument()
    expect(input).toBeEnabled()
    expect(send).toHaveBeenCalledTimes(1)
    if (exit === 'completed') {
      expect(screen.getByText('입력 예시')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: REFLECTION_EXAMPLE }))
      expect(input).toHaveValue(REFLECTION_EXAMPLE)
      expect(send).toHaveBeenCalledTimes(1)
    } else {
      expect(screen.queryByRole('button', { name: REFLECTION_EXAMPLE })).not.toBeInTheDocument()
    }
    if (exit === 'pending') expect(getPendingExperience()).toEqual(pending)
  })

  it('다음에 하기로 한 제안의 이전 힌트를 지우며 완료 예시를 만들지 않는다', async () => {
    const { user, send } = await setup()
    await user.click(screen.getByRole('button', { name: '다음에 할게요' }))
    expect(screen.queryByRole('button', { name: OLD_HINT })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: REFLECTION_EXAMPLE })).not.toBeInTheDocument()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('복귀 후 다음 확정 대화의 힌트로 바꾸며 체험 회고 예시를 남기지 않는다', async () => {
    const { user, say, send } = await setup()
    await user.click(screen.getByRole('button', { name: '체험 시작' }))
    await user.click(within(screen.getByRole('dialog', { name: '체험 테스트' })).getByRole('button', { name: 'completed' }))
    expect(screen.getByRole('button', { name: REFLECTION_EXAMPLE })).toBeInTheDocument()
    await say('다른 활동을 찾아보자')
    await waitFor(() => expect(screen.getByRole('button', { name: '새로운 활동을 알아보고 싶어' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: REFLECTION_EXAMPLE })).not.toBeInTheDocument()
    send.mockResolvedValueOnce({ turnId: 'no-hints', messages: [], stateChanges: [], hints: [], experience: null, ended: false })
    await say('조금 더 알려줘')
    await waitFor(() => expect(screen.getByLabelText('하고 싶은 말이나 행동')).toBeEnabled())
    expect(screen.queryByRole('button', { name: REFLECTION_EXAMPLE })).not.toBeInTheDocument()
  })
})
