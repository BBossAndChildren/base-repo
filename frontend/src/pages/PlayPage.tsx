import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ErrorScreen, Spinner } from '../components'
import { usePlayLoader } from '../hooks/usePlayLoader'
import { setLastPlayId } from '../lib/lastPlay'
import { savePlaySession } from '../lib/playSession'
import '../styles/play.css'
import { PlayView } from './play/PlayView'

/** 화면 2: 게임 (05-ui-ux.md) — 불러오기 · 접근 확인 후 PlayView */
export function PlayPage() {
  const { playId } = useParams()
  const { state, retry } = usePlayLoader(playId)
  const readyPlayId = state.status === 'ready' && !state.play.ended ? state.play.playId : null
  const readySessionId = state.status === 'ready' ? state.play.sessionId : null

  useEffect(() => {
    if (!readyPlayId) return
    setLastPlayId(readyPlayId)
    // 다른 기기에서 이어 해도 같은 sessionId 로 3D 체험을 잇는다 (03 1-7)
    if (readySessionId) savePlaySession(readyPlayId, readySessionId)
  }, [readyPlayId, readySessionId])

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

  return <PlayView key={state.play.playId} play={state.play} />
}
