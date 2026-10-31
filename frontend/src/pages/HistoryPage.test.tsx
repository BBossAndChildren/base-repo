import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../api'
import { ApiError } from '../api/errors'
import { clearPlayerId } from '../api/player'
import { PlayerContext } from '../app/playerContext'
import { ToastProvider } from '../components'
import { formatDate } from '../lib/formatDate'
import { mockControl, mockGameApi } from '../mocks/mockGameApi'
import { HistoryPage } from './HistoryPage'

function renderHistory() {
  render(
    <PlayerContext.Provider value={{ playerId: 'p', resetPlayer: vi.fn() }}>
      <ToastProvider>
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      </ToastProvider>
    </PlayerContext.Provider>,
  )
}

describe('HistoryPage', () => {
  beforeEach(async () => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
    await ensurePlayerId(mockGameApi)
  })

  it('기록이 없으면 첫 인생 시작을 안내한다', async () => {
    renderHistory()
    expect(await screen.findByRole('heading', { name: '아직 살아 본 인생이 없어요' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '인생 시작하기' })).toHaveAttribute('href', '/')
  })

  it('진행 중은 [이어하기], 끝난 인생은 [결말 보기] 로 이어진다', async () => {
    const ongoing = await mockGameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
    const done = await mockGameApi.startPlay({ name: '하늘', age: 24, situation: '구직 중', hasDreamJob: false })
    await mockGameApi.sendTurn(done.playId, { requestId: crypto.randomUUID(), message: '끝' })
    renderHistory()
    const list = await screen.findByRole('list', { name: '지난 인생 목록' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    const ongoingItem = items.find((item) => item.textContent?.includes('민준'))!
    expect(within(ongoingItem).getByText('진행 중')).toBeInTheDocument()
    expect(within(ongoingItem).getByRole('link', { name: '이어하기' })).toHaveAttribute('href', `/play/${ongoing.playId}`)
    const doneItem = items.find((item) => item.textContent?.includes('하늘'))!
    expect(within(doneItem).getByText('끝난 인생')).toBeInTheDocument()
    expect(within(doneItem).getByRole('link', { name: '결말 보기' })).toHaveAttribute('href', `/play/${done.playId}/result`)
    expect(within(doneItem).getByText(/^시작 \d{4}\.\d{2}\.\d{2}$/)).toBeInTheDocument()
  })

  it('최근에 시작한 인생이 위에 온다', async () => {
    vi.spyOn(mockGameApi, 'listMyPlays').mockResolvedValueOnce({
      plays: [
        { playId: 'a', startedAt: '2026-10-28T10:00:00+09:00', ended: true, summary: '오래된 인생' },
        { playId: 'b', startedAt: '2026-10-31T10:00:00+09:00', ended: false, summary: '최근 인생' },
      ],
    })
    renderHistory()
    const items = within(await screen.findByRole('list', { name: '지난 인생 목록' })).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('최근 인생')
  })

  it('불러오기에 실패하면 다시 시도할 수 있다', async () => {
    vi.spyOn(mockGameApi, 'listMyPlays').mockRejectedValueOnce(new ApiError(0, 'NETWORK'))
    renderHistory()
    expect(await screen.findByText('연결이 끊겼어요. 인터넷 연결을 확인해 주세요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '아직 살아 본 인생이 없어요' })).toBeInTheDocument()
  })
})

describe('formatDate', () => {
  it('날짜를 YYYY.MM.DD 로', () => {
    expect(formatDate('2026-10-30T12:00:00Z')).toMatch(/^2026\.10\.3[01]$/)
    expect(formatDate('잘못된 값')).toBe('')
  })
})
