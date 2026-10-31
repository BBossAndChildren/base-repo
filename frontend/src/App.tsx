import { env } from './lib/env'

// 1단계 자리표시 화면. 라우팅 · 화면은 이후 단계에서 채운다 (docs/development/05-ui-ux.md)
export default function App() {
  return (
    <main className="app-placeholder">
      <h1>어른왕자</h1>
      <p>프론트 프로젝트 기반이 준비되었습니다.</p>
      <p className="app-placeholder__meta">
        API 모드: {env.useMock ? 'mock' : '실제 서버'}
      </p>
    </main>
  )
}
