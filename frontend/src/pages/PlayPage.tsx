import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ErrorScreen, Spinner } from '../components'
import { usePlayLoader } from '../hooks/usePlayLoader'
import { setLastPlayId } from '../lib/lastPlay'

/** 화면 2: 게임 (05-ui-ux.md). 채팅 · 상태 패널은 6단계에서 채운다 */
export function PlayPage() {
  const { playId } = useParams()
  const { state, retry } = usePlayLoader(playId)
  const readyPlayId = state.status === 'ready' && !state.play.ended ? state.play.playId : null

  useEffect(() => {
    if (readyPlayId) setLastPlayId(readyPlayId)
  }, [readyPlayId])

  if (state.status === 'loading')
    return (
      <div className="page-narrow">
        <Spinner label="인생을 불러오는 중" />
      </div>
    )

  if (state.status === 'error') {
    const notFound = state.error.type === 'NOT_FOUND' || state.error.type === 'UNKNOWN_PLAYER'
    return (
      <ErrorScreen
        title={notFound ? '인생을 찾을 수 없어요' : undefined}
        message={notFound ? '주소가 맞는지 확인하거나 새 인생을 시작해 주세요.' : state.error.message}
        onRetry={notFound ? undefined : retry}
        action={
          <Link className="btn btn-secondary" to="/">
            시작 화면으로
          </Link>
        }
      />
    )
  }

  if (state.play.ended) return <Navigate to={`/play/${state.play.playId}/result`} replace />

  return (
    <div className="page">
      <p className="muted">
        {state.play.state.age}세 · 대화 {state.play.messages.length}개 — 게임 화면은 다음 단계에서 채워요.
      </p>
    </div>
  )
}
