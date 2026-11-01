import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Spinner } from '../../components'
import { env } from '../../lib/env'
import { mountRoomPreview } from '../../lib/roomPreview'
import type { ExperienceSuggestion } from '../../types/api'

/** 카드 위 작은 글자 · 직업 옆 배지 (근거별) */
const BASIS_LABEL: Record<ExperienceSuggestion['basis'], { kicker: string; badge: string }> = {
  currentJob: { kicker: '내 직업', badge: '현재 직업' },
  dreamJob: { kicker: '되고 싶은 일', badge: '희망 직업' },
  random: { kicker: '오늘의 직업 체험', badge: '새로운 일' },
}

/** 방 3D 미리보기. 인트로 에셋이 없거나 불러오지 못하면 방 이름만 보여 준다 */
export function RoomPreview({ roomId, roomName, large = false }: { roomId: string; roomName: string; large?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>(env.introAssetBase ? 'loading' : 'fallback')

  useEffect(() => {
    const host = hostRef.current
    if (!host || !env.introAssetBase) return
    let dispose: (() => void) | null = null
    let cancelled = false
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const background = getComputedStyle(host).getPropertyValue('--color-surface-2').trim() || '#263339'
    mountRoomPreview(host, `${env.introAssetBase}models/${roomId}.glb`, { rotate: !reduced, background })
      .then((cleanup) => {
        if (cancelled) cleanup()
        else {
          dispose = cleanup
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback')
      })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [roomId])

  return (
    <div ref={hostRef} className={large ? 'exp-room is-large' : 'exp-room'} role="img" aria-label={`${roomName || roomId} 3D 공간`}>
      {status === 'loading' && <Spinner size="sm" label="3D 공간을 불러오는 중" />}
      {status === 'fallback' && (
        <span className="exp-room-fallback" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-6 9 6-9 6-9-6z" />
            <path d="M3 9v6l9 6 9-6V9" />
          </svg>
          {roomName || roomId}
        </span>
      )}
    </div>
  )
}

interface ExperienceCardProps {
  suggestion: ExperienceSuggestion | null
  /** 추천을 받는 중 */
  loading: boolean
  /** 추천을 받지 못함 (다시 시도 버튼) */
  failed: boolean
  /** 응답 대기 · 일시정지 · 종료 · 체험 중이면 잠근다 */
  disabled: boolean
  onStart: (suggestion: ExperienceSuggestion) => void
  onShuffle: () => void
}

/**
 * 게임 화면 상태 패널 아래 3D 체험 카드 (05 화면 2, 12 결정 31).
 * AI 가 채팅에서 3D 분기를 주지 않아도 언제든 직업 체험을 할 수 있다
 */
export function ExperienceCard({ suggestion, loading, failed, disabled, onStart, onShuffle }: ExperienceCardProps) {
  const [detail, setDetail] = useState(false)

  if (!suggestion)
    return (
      <section className="exp-suggest" aria-label="3D 직업 체험" aria-busy={loading || undefined}>
        {failed ? (
          <>
            <p className="small muted">3D 체험을 고르지 못했어요.</p>
            <Button size="sm" variant="ghost" onClick={onShuffle} disabled={disabled}>
              다시 시도
            </Button>
          </>
        ) : (
          <Spinner size="sm" label="3D 체험을 고르는 중" />
        )}
      </section>
    )

  const label = BASIS_LABEL[suggestion.basis]
  return (
    <section className="exp-suggest" aria-label="3D 직업 체험" aria-busy={loading || undefined}>
      <div className="exp-suggest-head">
        <div>
          <span className="exp-suggest-kicker">{label.kicker}</span>
          <div className="exp-suggest-title">
            <h2>{suggestion.job}</h2>
            <span className="badge badge-success">{label.badge}</span>
          </div>
        </div>
        <button type="button" className="exp-suggest-shuffle" onClick={onShuffle} disabled={disabled || loading} aria-label="다른 체험 고르기" title="다른 체험 고르기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 3h5v5" />
            <path d="M4 20L21 3" />
            <path d="M21 16v5h-5" />
            <path d="M15 15l6 6" />
            <path d="M4 4l5 5" />
          </svg>
        </button>
      </div>
      <RoomPreview key={suggestion.roomId} roomId={suggestion.roomId} roomName={suggestion.roomName} />
      <p className="exp-suggest-task">{suggestion.title}</p>
      <div className="exp-suggest-actions">
        <Button onClick={() => onStart(suggestion)} disabled={disabled}>
          내 업무 체험하기
        </Button>
        <button type="button" className="exp-suggest-link" onClick={() => setDetail(true)}>
          3D 공간 보기 →
        </button>
      </div>
      <Modal
        open={detail}
        title={`${suggestion.roomName || suggestion.roomId} · ${suggestion.title}`}
        onClose={() => setDetail(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDetail(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                setDetail(false)
                onStart(suggestion)
              }}
              disabled={disabled}
            >
              내 업무 체험하기
            </Button>
          </>
        }
      >
        {detail && <RoomPreview roomId={suggestion.roomId} roomName={suggestion.roomName} large />}
        <p className="small">{suggestion.reason}</p>
        {suggestion.description && <p className="small muted">{suggestion.description}</p>}
        <p className="small muted">관련 직업: {suggestion.jobs.join(', ')}</p>
      </Modal>
    </section>
  )
}
