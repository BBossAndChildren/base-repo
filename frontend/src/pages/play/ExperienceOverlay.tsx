import { useCallback, useEffect, useRef, useState } from 'react'
import { experienceApi, type ExperienceApi } from '../../api'
import { Button, Modal, Spinner, useToast } from '../../components'
import { absoluteBuildUrl, loadManifest, loadRuntimeFromBuild, type RuntimeLoader } from '../../lib/experience/runtime'
import { clearPendingExperience, getPendingExperience, setPendingExperience } from '../../lib/pendingExperience'
import '../../styles/experience.css'
import type { ExperienceOffer } from '../../types/api'
import type { CareerEvent, ExperienceClient, ExperienceRuntime, Outbox, SupportedManifest } from '../../types/unity'
import { EXPERIENCE_MESSAGES, type ExperienceExit } from './experienceMessages'

const READY_TIMEOUT_MS = 60_000
const HEARTBEAT_MS = 30_000
const FLUSH_MS = 2_000
const FINAL_FLUSH_WAIT_MS = 5_000
/** Unity 배경색 — 불투명 6자리만 허용. 페이지 배경(--color-bg, 디자인 토큰 semantic.surface.film)과 같은 값 (05-ui-ux.md 4-1) */
export const EXPERIENCE_BACKGROUND = '#101e24'


type Phase = 'loading' | 'ready' | 'starting' | 'running' | 'ending' | 'error'

interface ExperienceOverlayProps {
  playId: string
  sessionId: string
  offer: ExperienceOffer
  onClose: (exit: ExperienceExit) => void
  /** 테스트에서 바꿔 끼운다 */
  loadRuntime?: RuntimeLoader
  api?: ExperienceApi
  fetchManifest?: (buildUrl: string) => Promise<SupportedManifest>
}

/** 화면 3: 3D 체험 (05-ui-ux.md 화면 3 · 4-1, 10 4-3 ~ 4-5) */
export function ExperienceOverlay({ playId, sessionId, offer, onClose, loadRuntime = loadRuntimeFromBuild, api = experienceApi, fetchManifest = loadManifest }: ExperienceOverlayProps) {
  const toast = useToast()
  const buildUrl = absoluteBuildUrl(offer.buildUrl)
  const frameSrc = (() => {
    const url = new URL('index.html', buildUrl)
    url.searchParams.set('parentOrigin', window.location.origin)
    return url.href
  })()

  const [phase, setPhase] = useState<Phase>('loading')
  const [loaded, setLoaded] = useState<{ runtime: ExperienceRuntime; manifest: SupportedManifest } | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const clientRef = useRef<ExperienceClient | null>(null)
  const outboxRef = useRef<Outbox | null>(null)
  const experienceIdRef = useRef<string | null>(null)
  const closedRef = useRef(false)
  const readyRef = useRef(false)

  const close = useCallback(
    (exit: ExperienceExit) => {
      if (closedRef.current) return
      closedRef.current = true
      onClose(exit)
    },
    [onClose],
  )

  const fail = useCallback(
    (message: string) => {
      toast.show({ type: 'error', message })
      close('skipped')
    },
    [toast, close],
  )

  // 1) 지원 목록 · Unity 연결 코드 불러오기
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchManifest(buildUrl), loadRuntime(buildUrl)])
      .then(([manifest, runtime]) => {
        if (cancelled) return
        const supported = manifest.supported.some(
          (row) => row.buildId === offer.buildId && row.roomId === offer.roomId && row.scenarioId === offer.scenarioId && row.scenarioVersion === offer.scenarioVersion,
        )
        if (manifest.build.build_id !== offer.buildId || !supported) {
          toast.show({ message: EXPERIENCE_MESSAGES.noMatch })
          close('skipped')
          return
        }
        setLoaded({ runtime, manifest })
      })
      .catch(() => {
        if (!cancelled) fail(EXPERIENCE_MESSAGES.loadFailed)
      })
    return () => {
      cancelled = true
    }
  }, [buildUrl, offer, fetchManifest, loadRuntime, toast, close, fail])

  const finish = useCallback(
    async (ended: CareerEvent) => {
      clearPendingExperience()
      // 저장 확인을 잠시 기다린다. 남은 이벤트는 전송 큐가 계속 다시 보낸다
      await Promise.race([outboxRef.current?.flush(), new Promise((resolve) => setTimeout(resolve, FINAL_FLUSH_WAIT_MS))])
      close(ended.result.outcome === 'pending' ? 'aborted' : ended.result.outcome)
    },
    [close],
  )

  // 2) iframe 이 생기면 전송 큐 · 연결 클라이언트 만들기
  useEffect(() => {
    if (!loaded || !frameRef.current) return
    const outbox = loaded.runtime.createOutbox({ key: `adult-prince:outbox:${sessionId}`, send: (event) => api.sendEvent(playId, event) })
    outboxRef.current = outbox
    const client = loaded.runtime.createExperienceClient({
      frame: frameRef.current,
      manifest: loaded.manifest,
      sessionId,
      outbox,
      onStatus: (status) => {
        if (status.value !== 'ready' || readyRef.current) return
        readyRef.current = true
        setPhase('ready')
      },
      onEvent: (event) => {
        void outbox.flush()
        // Unity 가 스스로 체험을 끝낸 경우 (종료 버튼을 누르지 않아도)
        if (event.type === 'experience.ended' && event.experienceId === experienceIdRef.current) void finish(event)
      },
    })
    clientRef.current = client
    client.setPresentation({ backgroundColor: EXPERIENCE_BACKGROUND })
    const flushTimer = setInterval(() => void outbox.flush(), FLUSH_MS)
    // Unity 가 정해진 시간 안에 준비되지 않으면 불러오기 실패로 본다
    const readyTimer = setTimeout(() => {
      if (!readyRef.current) fail(EXPERIENCE_MESSAGES.loadFailed)
    }, READY_TIMEOUT_MS)
    return () => {
      clearInterval(flushTimer)
      clearTimeout(readyTimer)
      client.dispose()
      clientRef.current = null
    }
  }, [loaded, sessionId, playId, api, finish, fail])

  // 3) 체험 중 생존 신호 (30초)
  useEffect(() => {
    if (phase !== 'running' || !experienceIdRef.current) return
    const experienceId = experienceIdRef.current
    const timer = setInterval(() => {
      api.heartbeat(playId, { sessionId, experienceId }).catch(() => undefined)
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [phase, api, playId, sessionId])

  async function start() {
    const client = clientRef.current
    if (!client) return
    setPhase('starting')
    // 종료 응답을 받지 못한 이전 체험이 있으면 먼저 정산한다 (03 1-8)
    const previous = getPendingExperience()
    const experienceId = crypto.randomUUID()
    if (previous && previous.playId === playId) {
      try {
        const resolution = await api.reconcile(playId, {
          schemaVersion: 1,
          protocol: 'career-experience-resolution',
          action: 'reconcile_experience',
          reconcileRequestId: crypto.randomUUID(),
          sessionId: previous.sessionId,
          experienceId: previous.experienceId,
          roomId: previous.roomId,
          trigger: 'NEW_PLAY_START',
          newExperienceId: experienceId,
        })
        if (resolution.lifecycleStatus === 'interrupted') toast.show({ message: EXPERIENCE_MESSAGES.interrupted })
        if (resolution.lifecycleStatus !== 'pending_reconciliation' && resolution.lifecycleStatus !== 'deferred_active') clearPendingExperience()
      } catch {
        // 정산 실패는 새 체험을 막지 않는다. 다음 기회에 다시 정산한다
      }
    }
    experienceIdRef.current = experienceId
    setPendingExperience({ playId, sessionId, experienceId, roomId: offer.roomId, offerId: offer.offerId })
    try {
      await client.start(
        { buildId: offer.buildId, roomId: offer.roomId, scenarioId: offer.scenarioId, scenarioVersion: offer.scenarioVersion },
        { experienceId, requestId: crypto.randomUUID() },
      )
      setPhase('running')
      frameRef.current?.focus()
    } catch {
      clearPendingExperience()
      setPhase('error')
    }
  }

  async function end() {
    const client = clientRef.current
    const experienceId = experienceIdRef.current
    if (!client || !experienceId) return
    setPhase('ending')
    const requestId = crypto.randomUUID()
    try {
      await finish(await client.end({ requestId }))
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'RESPONSE_UNCONFIRMED') {
        // 5초 안에 종료 응답이 없음 → 미수신 기록 (중단 확정 아님). 다음 체험 시작 때 정산한다
        await api.markPending(playId, { sessionId, experienceId, roomId: offer.roomId, requestId, reason: 'END_RESPONSE_TIMEOUT' }).catch(() => undefined)
        toast.show({ message: EXPERIENCE_MESSAGES.pending })
        close('pending')
        return
      }
      setPhase('error')
    }
  }

  const titleId = 'experience-title'
  return (
    <section className="exp-overlay is-fullscreen" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={phase === 'loading' || undefined}>
      <div className="exp-topbar">
        <span className="exp-title" id={titleId}>
          {offer.title}
        </span>
        {phase === 'running' && (
          <Button variant="secondary" size="sm" onClick={() => void end()}>
            체험 종료하기
          </Button>
        )}
        {phase === 'ending' && (
          <Button size="sm" loading>
            종료하는 중…
          </Button>
        )}
        {(phase === 'loading' || phase === 'ready') && (
          <Button variant="ghost" size="sm" onClick={() => close('skipped')}>
            다음에 할게요
          </Button>
        )}
      </div>

      <div className="exp-stage has-frame">
        {loaded && <iframe ref={frameRef} className="exp-frame" src={frameSrc} title="직업 3D 체험" allow="fullscreen; autoplay" />}
        {(phase === 'loading' || phase === 'starting') && (
          <div className="exp-stage-cover" role="status">
            <div className="exp-loading">
              <Spinner decorative />
              <p style={{ margin: 'var(--space-3) 0 0', fontWeight: 700 }}>{phase === 'loading' ? '3D 체험을 불러오고 있어요' : '체험을 시작하고 있어요'}</p>
              <p className="small muted" style={{ margin: 0 }}>
                처음에는 조금 오래 걸릴 수 있어요
              </p>
            </div>
          </div>
        )}
        {phase === 'ready' && (
          <div className="exp-stage-cover">
            <div>
              <h3 style={{ fontSize: 'var(--text-xl)' }}>준비됐어요!</h3>
              <p className="muted">{offer.jobs.length > 0 ? `${offer.jobs.join(', ')}의 일터에서 물건 3개를 하나씩 다뤄 보세요.` : '물건 3개를 하나씩 살펴보고 다뤄 보세요.'}</p>
              <Button size="lg" onClick={() => void start()}>
                체험 시작하기
              </Button>
            </div>
          </div>
        )}
        {phase === 'ending' && (
          <div className="exp-stage-cover" role="status">
            <div className="exp-loading">
              <Spinner decorative />
              <p style={{ margin: 'var(--space-3) 0 0', fontWeight: 700 }}>체험 기록을 저장하는 중…</p>
            </div>
          </div>
        )}
      </div>

      {(phase === 'ready' || phase === 'running') && (
        <div className="sound-note" role="note">
          <span className="icon" aria-hidden="true">
            🔊
          </span>
          <span>
            <strong>효과음을 들으려면</strong> 체험이 시작된 뒤 게임 화면 안의 <strong>“효과음 켜기”</strong> 버튼을 한 번 눌러 주세요. 브라우저 정책 때문에 화면 안을 눌러야 소리가 나요.
          </span>
        </div>
      )}

      <Modal open={phase === 'error'} icon="!" title="3D 체험을 종료했어요" actions={<Button onClick={() => close('error')}>텍스트로 계속하기</Button>}>
        <p>{EXPERIENCE_MESSAGES.errorBody}</p>
      </Modal>
    </section>
  )
}
