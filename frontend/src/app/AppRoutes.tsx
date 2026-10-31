import { Route, Routes } from 'react-router'
import { ComponentsPreviewPage } from '../pages/ComponentsPreviewPage'
import { HistoryPage } from '../pages/HistoryPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlayPage } from '../pages/PlayPage'
import { ResultPage } from '../pages/ResultPage'
import { StartPage } from '../pages/StartPage'
import { AppLayout } from './AppLayout'

/** 라우팅 (05-ui-ux.md 2절) */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<StartPage />} />
        <Route path="play/:playId" element={<PlayPage />} />
        <Route path="play/:playId/result" element={<ResultPage />} />
        <Route path="history" element={<HistoryPage />} />
        {import.meta.env.DEV && <Route path="dev/components" element={<ComponentsPreviewPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
