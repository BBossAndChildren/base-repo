import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { shouldShowIntro } from '../../lib/introSeen'

// 3D 컴포넌트는 가짜로 바꾸고 화면 흐름(완료 · 건너뛰기 · 실패)만 확인한다
vi.mock('./CareerIntro', () => ({
  CareerIntro: ({ assetBase, onComplete, onError }: { assetBase: string; onComplete: () => void; onError: (m: string) => void }) => (
    <div data-testid="career-intro" data-asset-base={assetBase}>
      <button onClick={onComplete}>가짜 재생 끝</button>
      <button onClick={() => onError('공간 로딩 실패')}>가짜 실패</button>
    </div>
  ),
}))

import IntroPage, { INTRO_FAILED_MESSAGE } from './IntroPage'

function renderIntro() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/intro']}>
        <Routes>
          <Route path="intro" element={<IntroPage />} />
          <Route path="/" element={<h1>시작 화면</h1>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('인트로 화면 (FE11)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('에셋 주소를 넘기고, 끝까지 보면 시작 화면으로 가며 다음 방문부터 생략한다', async () => {
    renderIntro()
    expect(screen.getByTestId('career-intro')).toHaveAttribute('data-asset-base', '/intro-assets/')
    expect(shouldShowIntro()).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: '가짜 재생 끝' }))
    expect(await screen.findByRole('heading', { name: '시작 화면' })).toBeInTheDocument()
    expect(shouldShowIntro()).toBe(false)
    sessionStorage.clear()
    expect(shouldShowIntro()).toBe(false)
  })

  it('[건너뛰기] 를 누르면 바로 시작 화면으로 가고 본 것으로 기록한다', async () => {
    renderIntro()
    await userEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    expect(await screen.findByRole('heading', { name: '시작 화면' })).toBeInTheDocument()
    expect(shouldShowIntro()).toBe(false)
  })

  it('불러오기에 실패하면 토스트 후 시작 화면으로 가고, 이번 방문만 생략한다', async () => {
    renderIntro()
    await userEvent.click(screen.getByRole('button', { name: '가짜 실패' }))
    expect(await screen.findByRole('heading', { name: '시작 화면' })).toBeInTheDocument()
    expect(screen.getByText(INTRO_FAILED_MESSAGE)).toBeInTheDocument()
    expect(shouldShowIntro()).toBe(false)
    sessionStorage.clear() // 새 방문
    expect(shouldShowIntro()).toBe(true)
  })
})
