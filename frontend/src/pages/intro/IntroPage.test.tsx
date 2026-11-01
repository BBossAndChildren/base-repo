import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { resetIntroForPageLoad, shouldShowIntro } from '../../lib/introSeen'

// 인트로 에셋 주소는 테스트마다 바꿀 수 있게 env 를 가짜로 둔다 (백엔드 BE15 주소가 있는 배포 / 없는 배포)
const fakeEnv = vi.hoisted(() => ({ apiBaseUrl: '', useMock: true, introAssetBase: 'https://backend.example/intro-assets/' as string | null }))
vi.mock('../../lib/env', () => ({ env: fakeEnv }))

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
    resetIntroForPageLoad()
    fakeEnv.introAssetBase = 'https://backend.example/intro-assets/'
  })

  it('에셋 주소가 없으면 인트로를 띄우지 않고 시작 화면으로 보낸다', async () => {
    fakeEnv.introAssetBase = null
    renderIntro()
    expect(await screen.findByRole('heading', { name: '시작 화면' })).toBeInTheDocument()
    expect(screen.queryByTestId('career-intro')).not.toBeInTheDocument()
  })

  it('에셋 주소를 넘기고, 끝까지 보면 시작 화면으로 가며 같은 페이지에서는 생략하고 새로고침하면 다시 보여 준다 (#178)', async () => {
    renderIntro()
    expect(screen.getByTestId('career-intro')).toHaveAttribute('data-asset-base', 'https://backend.example/intro-assets/')
    expect(shouldShowIntro()).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: '가짜 재생 끝' }))
    expect(await screen.findByRole('heading', { name: '시작 화면' })).toBeInTheDocument()
    expect(shouldShowIntro()).toBe(false)
    resetIntroForPageLoad() // 새로고침
    expect(shouldShowIntro()).toBe(true)
  })

  it('예전 방식(localStorage)으로 본 기록이 있어도 새로 열면 보여 준다 (#178)', () => {
    localStorage.setItem('adult-prince.introSeen', '1')
    expect(shouldShowIntro()).toBe(true)
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
