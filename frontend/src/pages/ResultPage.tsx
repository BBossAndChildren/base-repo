import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, gameApi } from '../api'
import { usePlayer } from '../app/playerContext'
import { Button, ErrorScreen, Spinner } from '../components'
import { clearLastPlayId } from '../lib/lastPlay'
import '../styles/result.css'
import type { PlayResult } from '../types/api'
import { JobCard } from './result/JobCard'

type Settled = { key: string } & ({ status: 'ready'; result: PlayResult } | { status: 'error'; error: ApiError })

/** 화면 4: 결말 (05-ui-ux.md 화면 4, 03 1-5) */
export function ResultPage() {
  const { playId } = useParams()
  const navigate = useNavigate()
  const { resetPlayer } = usePlayer()
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const key = `${playId ?? ''}#${attempt}`

  useEffect(() => {
    if (!playId) return
    let cancelled = false
    gameApi
      .getResult(playId)
      .then((result) => {
        if (cancelled) return
        // 끝난 인생은 더 이어 할 수 없다
        clearLastPlayId()
        setSettled({ key, status: 'ready', result })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
        if (apiError.type === 'UNKNOWN_PLAYER') void resetPlayer()
        setSettled({ key, status: 'error', error: apiError })
      })
    return () => {
      cancelled = true
    }
  }, [playId, key, resetPlayer])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (!settled || settled.key !== key) return <ResultLoading />

  if (settled.status === 'error') {
    const { error } = settled
    if (error.type === 'NOT_ENDED')
      return (
        <ErrorScreen
          title="아직 이야기가 끝나지 않았어요"
          message="이야기를 마치면 결말을 볼 수 있어요."
          action={
            <Link className="btn btn-primary" to={`/play/${playId}`}>
              이야기로 돌아가기
            </Link>
          }
        />
      )
    const notFound = error.type === 'NOT_FOUND' || error.type === 'UNKNOWN_PLAYER'
    return (
      <ErrorScreen
        title={notFound ? '결말을 찾을 수 없어요' : undefined}
        message={notFound ? '주소가 맞는지 확인하거나 새 인생을 시작해 주세요.' : error.message}
        onRetry={notFound ? undefined : retry}
        action={
          <Link className="btn btn-secondary" to="/">
            시작 화면으로
          </Link>
        }
      />
    )
  }

  const { result } = settled
  return (
    <div className="page">
      <section className="ending-hero" aria-labelledby="ending-title">
        <Stars />
        <p className="ending-meta">이번 인생이 끝났어요</p>
        <h1 id="ending-title">이번 인생의 결말</h1>
        <p>{result.ending}</p>
      </section>

      <section aria-labelledby="rec-title">
        <h2 id="rec-title" className="section-title">
          이번 인생에서 관심을 보인 일 · 다음에 경험해 볼 일
        </h2>
        <div className="job-grid">
          {result.recommendedJobs.map((job, index) => (
            <JobCard key={job.job} job={job} index={index} />
          ))}
        </div>
        <p className="disclaimer" style={{ marginTop: 'var(--space-4)' }} role="note">
          <span aria-hidden="true">ⓘ</span>
          <span>이 추천은 적성이나 능력을 판정한 결과가 아니라, 이번 인생에서 한 경험과 대화를 바탕으로 한 제안이에요. 실제 진로나 취업을 보장하지 않아요. 직업 정보 출처: 직업백과</span>
        </p>
      </section>

      <div className="result-actions">
        <Button size="lg" onClick={() => navigate('/')}>
          다른 인생 살아 보기
        </Button>
        <Link className="btn btn-secondary btn-lg" to="/history">
          지난 기록 보기
        </Link>
      </div>
    </div>
  )
}

/** 결말을 처음 만들 때 AI 가 쓰는 동안 (05 화면 4) */
function ResultLoading() {
  return (
    <div className="page">
      <section className="ending-hero" aria-busy="true">
        <Stars />
        <Spinner label="이번 인생을 정리하는 중" />
        <p style={{ marginTop: 'var(--space-3)' }}>이번 인생을 정리하는 중…</p>
      </section>
      <div className="job-grid" style={{ marginTop: 'var(--space-6)' }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card skeleton-card">
            <span className="skeleton" />
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stars() {
  return (
    <svg className="stars" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="30" cy="30" r="2" fill="#E9B949" />
      <circle cx="90" cy="150" r="1.5" fill="#E9B949" />
      <circle cx="350" cy="40" r="2.5" fill="#E9B949" />
      <circle cx="300" cy="160" r="1.5" fill="#E9B949" />
      <circle cx="200" cy="20" r="1.2" fill="#fff" />
      <circle cx="380" cy="110" r="1.2" fill="#fff" />
    </svg>
  )
}
