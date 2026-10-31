import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError, gameApi } from '../api'
import { usePlayer } from '../app/playerContext'
import { Badge, ErrorScreen, Spinner } from '../components'
import { formatDate } from '../lib/formatDate'
import '../styles/history.css'
import type { PlaySummary } from '../types/api'

type Settled = { attempt: number } & ({ status: 'ready'; plays: PlaySummary[] } | { status: 'error'; error: ApiError })

/** 화면 5: 지난 기록 (05-ui-ux.md 화면 5, 03 1-6, 선택 기능 FE10) */
export function HistoryPage() {
  const { resetPlayer } = usePlayer()
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    let cancelled = false
    gameApi
      .listMyPlays()
      .then(({ plays }) => {
        if (!cancelled) setSettled({ attempt, status: 'ready', plays: [...plays].sort((a, b) => b.startedAt.localeCompare(a.startedAt)) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
        if (apiError.type === 'UNKNOWN_PLAYER') void resetPlayer()
        setSettled({ attempt, status: 'error', error: apiError })
      })
    return () => {
      cancelled = true
    }
  }, [attempt, resetPlayer])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return (
    <div className="page-narrow">
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>지난 기록</h1>
      <p className="muted">지금까지 살아 본 인생들이에요. 이 브라우저에서 플레이한 기록만 보여요.</p>

      {(!settled || settled.attempt !== attempt) && <Spinner label="지난 기록을 불러오는 중" />}

      {settled?.attempt === attempt && settled.status === 'error' && <ErrorScreen message={settled.error.message} onRetry={retry} />}

      {settled?.attempt === attempt && settled.status === 'ready' && settled.plays.length === 0 && (
        <div className="card error-screen" style={{ marginTop: 'var(--space-5)' }}>
          <div className="error-art" aria-hidden="true">
            🌱
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>아직 살아 본 인생이 없어요</h2>
          <p className="muted">첫 인생을 시작해 볼까요?</p>
          <Link className="btn btn-primary" to="/">
            인생 시작하기
          </Link>
        </div>
      )}

      {settled?.attempt === attempt && settled.status === 'ready' && settled.plays.length > 0 && (
        <ul className="history-list" style={{ marginTop: 'var(--space-5)' }} aria-label="지난 인생 목록">
          {settled.plays.map((play) => (
            <li key={play.playId} className="card history-item">
              <div>
                {play.ended ? <Badge>끝난 인생</Badge> : <Badge tone="progress">진행 중</Badge>}
                <h2 style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-lg)' }}>{play.summary}</h2>
                <div className="history-meta">
                  <span>시작 {formatDate(play.startedAt)}</span>
                </div>
              </div>
              {play.ended ? (
                <Link className="btn btn-secondary btn-sm" to={`/play/${play.playId}/result`}>
                  결말 보기
                </Link>
              ) : (
                <Link className="btn btn-primary btn-sm" to={`/play/${play.playId}`}>
                  이어하기
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
