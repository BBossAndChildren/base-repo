import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../api'
import { clearPlayerId, getPlayerId, setPlayerId } from '../api/player'
import { ToastProvider } from '../components'
import { clearLastPlayId, getLastPlayId, setLastPlayId } from '../lib/lastPlay'
import { mockControl, mockGameApi } from '../mocks/mockGameApi'
import { AppRoutes } from './AppRoutes'
import { PlayerGate } from './PlayerGate'

const START = { name: '민준', age: 15, situation: '중학생', hasDreamJob: false }

function renderApp(path = '/') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <PlayerGate api={mockGameApi}>
          <AppRoutes />
        </PlayerGate>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function createPlay({ ended = false } = {}) {
  await ensurePlayerId(mockGameApi)
  const play = await mockGameApi.startPlay(START)
  if (ended) await mockGameApi.sendTurn(play.playId, { message: '끝' })
  return play.playId
}

describe('앱 시작 · 라우팅 · 이어하기', () => {
  beforeEach(() => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
    clearLastPlayId()
    localStorage.clear()
  })

  it('첫 접속이면 게스트 ID 를 발급 · 보관하고 시작 화면과 공통 틀을 보여 준다', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: '어른왕자', level: 1 })).toBeInTheDocument()
    expect(getPlayerId()).toBeTruthy()
    expect(screen.getByRole('link', { name: '지난 기록' })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('진로 · 취업을 보장하지 않습니다')
  })

  it('이미 게스트 ID 가 있으면 다시 발급하지 않는다', async () => {
    const existing = await ensurePlayerId(mockGameApi)
    const spy = vi.spyOn(mockGameApi, 'createPlayer')
    renderApp()
    await screen.findByRole('heading', { name: '어른왕자', level: 1 })
    expect(spy).not.toHaveBeenCalled()
    expect(getPlayerId()).toBe(existing)
    spy.mockRestore()
  })

  it('끝나지 않은 마지막 플레이가 있으면 이어하기 카드를 보여 준다', async () => {
    const playId = await createPlay()
    setLastPlayId(playId)
    renderApp()
    const card = await screen.findByRole('region', { name: '진행 중인 인생이 있어요' })
    expect(within(card).getByText(/15세/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '이어하기' })).toHaveAttribute('href', `/play/${playId}`)
  })

  it('마지막 플레이가 끝났거나 찾을 수 없으면 카드 없이 기억을 지운다', async () => {
    const playId = await createPlay({ ended: true })
    setLastPlayId(playId)
    const { unmount } = renderApp()
    await waitFor(() => expect(getLastPlayId()).toBeNull())
    expect(screen.queryByRole('region', { name: '진행 중인 인생이 있어요' })).not.toBeInTheDocument()
    unmount()

    setLastPlayId('없는-플레이')
    renderApp()
    await waitFor(() => expect(getLastPlayId()).toBeNull())
  })

  it('새로 시작하기는 확인 모달을 거치고, 이전 플레이를 끝내지 않는다', async () => {
    const playId = await createPlay()
    setLastPlayId(playId)
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: '새로 시작하기' }))
    const dialog = screen.getByRole('dialog', { name: '새 인생을 시작할까요?' })
    expect(dialog).toHaveTextContent('지난 기록에 남아요')
    await userEvent.click(within(dialog).getByRole('button', { name: '새로 시작하기' }))
    expect(screen.queryByRole('region', { name: '진행 중인 인생이 있어요' })).not.toBeInTheDocument()
    expect(getLastPlayId()).toBeNull()
    expect((await mockGameApi.getPlay(playId)).ended).toBe(false)
  })

  it('내 플레이 화면에 들어가면 불러오고 이어하기 대상으로 기억한다', async () => {
    const playId = await createPlay()
    renderApp(`/play/${playId}`)
    const panel = await screen.findByRole('complementary', { name: '내 상태' })
    expect(within(panel).getByText('15세')).toBeInTheDocument()
    expect(getLastPlayId()).toBe(playId)
  })

  it('없는 플레이는 안내와 시작 화면 링크를 보여 준다', async () => {
    renderApp('/play/없는-플레이')
    expect(await screen.findByRole('heading', { name: '인생을 찾을 수 없어요' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '시작 화면으로' })).toHaveAttribute('href', '/')
  })

  it('끝난 플레이 화면은 결말 화면으로 보낸다', async () => {
    const playId = await createPlay({ ended: true })
    renderApp(`/play/${playId}`)
    expect(await screen.findByRole('heading', { name: '이번 인생의 결말' })).toBeInTheDocument()
  })

  it('서버가 모르는 게스트 ID 면 새로 발급받는다', async () => {
    setPlayerId('서버가-모르는-ID')
    renderApp('/play/아무거나')
    // 401 → 저장된 ID 를 지우고 새로 발급 → 새 게스트로 다시 불러오면 내 플레이가 아니므로 안내
    expect(await screen.findByRole('heading', { name: '인생을 찾을 수 없어요' })).toBeInTheDocument()
    const reissued = getPlayerId()
    expect(reissued).toBeTruthy()
    expect(reissued).not.toBe('서버가-모르는-ID')
  })

  it('없는 경로는 안내 화면', async () => {
    renderApp('/없는/경로')
    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeInTheDocument()
  })
})
