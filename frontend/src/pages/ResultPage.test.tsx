import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../api'
import { ApiError } from '../api/errors'
import { clearPlayerId } from '../api/player'
import { PlayerContext } from '../app/playerContext'
import { ToastProvider } from '../components'
import { getLastPlayId, setLastPlayId } from '../lib/lastPlay'
import { mockControl, mockGameApi } from '../mocks/mockGameApi'
import { ResultPage } from './ResultPage'

async function createPlay(ended: boolean) {
  await ensurePlayerId(mockGameApi)
  const play = await mockGameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
  if (ended) await mockGameApi.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '끝' })
  return play.playId
}

function renderResult(playId: string) {
  render(
    <PlayerContext.Provider value={{ playerId: 'p', resetPlayer: vi.fn() }}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/play/${playId}/result`]}>
          <Routes>
            <Route path="/play/:playId/result" element={<ResultPage />} />
            <Route path="/play/:playId" element={<h1>게임 화면</h1>} />
            <Route path="/" element={<h1>시작 화면</h1>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </PlayerContext.Provider>,
  )
}

describe('ResultPage', () => {
  beforeEach(() => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
  })

  it('만드는 동안 "이번 인생을 정리하는 중…" 을 보여 준다', async () => {
    const playId = await createPlay(true)
    mockControl.setDelay(50)
    renderResult(playId)
    expect(screen.getByText('이번 인생을 정리하는 중…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '이번 인생의 결말' })).toBeInTheDocument()
  })

  it('결말과 추천 직업 3개 · 근거 · 새로운 일 · 준비 방향 · 안내 문구를 보여 준다', async () => {
    renderResult(await createPlay(true))
    expect(await screen.findByRole('heading', { name: '이번 인생의 결말' })).toBeInTheDocument()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(3)

    const planner = screen.getByRole('article', { name: '행사기획자' })
    expect(within(planner).getByText('관심을 보인 일')).toBeInTheDocument()
    expect(within(planner).getByText('3D 체험함')).toBeInTheDocument()
    expect(within(planner).getByText('대화에서 관심')).toBeInTheDocument()
    expect(within(planner).getAllByRole('listitem')).toHaveLength(2)

    const librarian = screen.getByRole('article', { name: '사서' })
    expect(within(librarian).getByText('다음에 경험해 볼 일')).toBeInTheDocument()
    expect(within(librarian).getByText('새로운 일')).toBeInTheDocument()
    expect(librarian).toHaveClass('is-new')

    expect(screen.getByRole('note')).toHaveTextContent('적성이나 능력을 판정한 결과가 아니라')
  })

  it('끝난 인생은 이어하기 기억에서 지운다', async () => {
    const playId = await createPlay(true)
    setLastPlayId(playId)
    renderResult(playId)
    await screen.findByRole('heading', { name: '이번 인생의 결말' })
    expect(getLastPlayId()).toBeNull()
  })

  it('아직 끝나지 않았으면 이야기로 돌아가기를 안내한다', async () => {
    const playId = await createPlay(false)
    renderResult(playId)
    expect(await screen.findByRole('heading', { name: '아직 이야기가 끝나지 않았어요' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '이야기로 돌아가기' }))
    expect(await screen.findByRole('heading', { name: '게임 화면' })).toBeInTheDocument()
  })

  it('AI 오류면 안내 후 다시 시도할 수 있다', async () => {
    const playId = await createPlay(true)
    const spy = vi.spyOn(mockGameApi, 'getResult').mockRejectedValueOnce(new ApiError(502, 'AI_UNAVAILABLE'))
    renderResult(playId)
    expect(await screen.findByText('잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '이번 인생의 결말' })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('없는 플레이는 찾을 수 없다고 안내한다', async () => {
    await ensurePlayerId(mockGameApi)
    renderResult('없는-플레이')
    expect(await screen.findByRole('heading', { name: '결말을 찾을 수 없어요' })).toBeInTheDocument()
  })

  it('[다른 인생 살아 보기] 는 시작 화면으로 간다', async () => {
    renderResult(await createPlay(true))
    await userEvent.click(await screen.findByRole('button', { name: '다른 인생 살아 보기' }))
    expect(await screen.findByRole('heading', { name: '시작 화면' })).toBeInTheDocument()
  })
})
