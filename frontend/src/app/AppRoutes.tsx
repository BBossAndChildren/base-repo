import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { shouldShowIntro } from '../lib/introSeen'
import { ComponentsPreviewPage } from '../pages/ComponentsPreviewPage'
import { DevPlayPreviewPage } from '../pages/DevPlayPreviewPage'
import { DevResultPreviewPage } from '../pages/DevResultPreviewPage'
import { HistoryPage } from '../pages/HistoryPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlayPage } from '../pages/PlayPage'
import { ResultPage } from '../pages/ResultPage'
import { StartPage } from '../pages/StartPage'
import { AppLayout } from './AppLayout'

// 인트로는 Three.js 를 포함해 무거우므로 따로 나눠 불러온다 (05-ui-ux.md 화면 0)
const IntroPage = lazy(() => import('../pages/intro/IntroPage'))
// 인트로 CSS 가 오기 전 잠깐 보이는 화면 (원본 인트로 배경색)
const INTRO_FALLBACK = { position: 'fixed', inset: 0, background: 'var(--color-bg)' } as const

/** 첫 방문이면 시작 화면 대신 인트로로 보낸다 (FE11) */
function StartOrIntro() {
  return shouldShowIntro() ? <Navigate to="/intro" replace /> : <StartPage />
}

/** 라우팅 (05-ui-ux.md 2절) */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="intro"
        element={
          <Suspense fallback={<div style={INTRO_FALLBACK} aria-label="인트로 준비 중" />}>
            <IntroPage />
          </Suspense>
        }
      />
      <Route element={<AppLayout />}>
        <Route index element={<StartOrIntro />} />
        <Route path="play/:playId" element={<PlayPage />} />
        <Route path="play/:playId/result" element={<ResultPage />} />
        <Route path="history" element={<HistoryPage />} />
        {import.meta.env.DEV && <Route path="dev/components" element={<ComponentsPreviewPage />} />}
        {import.meta.env.DEV && <Route path="dev/play" element={<DevPlayPreviewPage />} />}
        {import.meta.env.DEV && <Route path="dev/result" element={<DevResultPreviewPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
