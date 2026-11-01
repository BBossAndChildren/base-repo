import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ExperienceApi } from '../api'
import { Button, ErrorScreen, Spinner } from '../components'
import { env } from '../lib/env'
import { loadManifest } from '../lib/experience/runtime'
import { clearPendingExperience, getPendingExperience, setPendingExperience, type PendingExperience } from '../lib/pendingExperience'
import '../styles/work.css'
import type { ExperienceOffer } from '../types/api'
import type { CareerEvent, ExperienceResolution, ExperienceSelection, SupportedManifest } from '../types/unity'
import { ExperienceOverlay } from './play/ExperienceOverlay'
import type { ExperienceExit } from './play/experienceMessages'

/** 백엔드가 지금 제공하는 빌드 (backend 카탈로그와 같은 값). ?build= 로 바꿀 수 있다 */
export const DEFAULT_BUILD_ID = 'career-suite-integration-v005'
/** 이 페이지의 체험 이벤트는 실제 플레이에 섞이지 않게 백엔드로 보내지 않는다 */
const TEST_PLAY_ID = 'work-test'

/** 허용 목록 항목 — 화면에 보여 줄 제목 · 방 이름 · 설명이 함께 들어 있다 (docs/unity/builds) */
type ManifestRow = ExperienceSelection & { title?: string; roomName?: string; jobs?: string[]; description?: string }

interface LoggedEvent {
  type: string
  sequence: number
  at: string
}

/** 백엔드 대신 이벤트를 화면 기록에만 남기고 바로 저장 확인을 주는 어댑터 (내부 테스트용) */
function createLocalExperienceApi(onEvent: (event: CareerEvent) => void): ExperienceApi {
  return {
    async sendEvent(_playId, event) {
      onEvent(event)
      return { stored: true, sessionId: event.sessionId, eventId: event.eventId }
    },
    async reconcile(_playId, request) {
      return { type: 'experience.reconciled', experienceId: request.experienceId, lifecycleStatus: 'interrupted' } satisfies ExperienceResolution
    },
    async heartbeat() {
      return { leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() }
    },
    async markPending() {
      return {}
    },
  }
}

const pickRandom = <T,>(rows: T[], except?: T): T | undefined => {
  const pool = rows.length > 1 && except ? rows.filter((row) => row !== except) : rows
  return pool[Math.floor(Math.random() * pool.length)]
}

/** /work — 내부 테스트용: 백엔드 서버의 3D 빌드에서 체험 하나를 무작위로 골라 바로 해 본다 */
export function WorkPage() {
  const buildId = useMemo(() => {
    const requested = new URLSearchParams(window.location.search).get('build')
    // 빌드 ID 만 바꿀 수 있다 (주소는 환경변수의 백엔드로 고정)
    return requested && /^[\w.-]+$/.test(requested) ? requested : DEFAULT_BUILD_ID
  }, [])
  const buildUrl = env.apiBaseUrl ? `${env.apiBaseUrl}/builds/${buildId}/` : null
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const [rows, setRows] = useState<ManifestRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<ManifestRow | undefined>()
  const [running, setRunning] = useState(false)
  const [savedPending, setSavedPending] = useState<PendingExperience | null>(null)
  const [events, setEvents] = useState<LoggedEvent[]>([])
  const [lastExit, setLastExit] = useState<ExperienceExit | null>(null)

  useEffect(() => {
    if (!buildUrl) return
    let cancelled = false
    loadManifest(buildUrl)
      .then((manifest: SupportedManifest) => {
        if (cancelled) return
        const supported = manifest.supported as ManifestRow[]
        setRows(supported)
        setPicked(pickRandom(supported))
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(`체험 목록을 불러오지 못했어요 (${reason instanceof Error ? reason.message : 'UNKNOWN'})`)
      })
    return () => {
      cancelled = true
    }
  }, [buildUrl])

  const api = useMemo(
    () => createLocalExperienceApi((event) => setEvents((prev) => [...prev, { type: event.type, sequence: event.sequence, at: new Date().toLocaleTimeString('ko-KR') }])),
    [],
  )

  const offer: ExperienceOffer | null =
    picked && buildUrl
      ? {
          buildId: picked.buildId,
          buildUrl,
          roomId: picked.roomId,
          scenarioId: picked.scenarioId,
          scenarioVersion: picked.scenarioVersion,
          title: picked.title ?? picked.scenarioId,
          jobs: picked.jobs ?? [],
          reason: '내부 테스트',
        }
      : null

  function start() {
    // 실제 플레이의 "종료 미수신 체험" 기록을 덮어쓰지 않게 잠시 보관했다가 되돌린다
    setSavedPending(getPendingExperience())
    setEvents([])
    setLastExit(null)
    setRunning(true)
  }

  const close = useCallback(
    (exit: ExperienceExit) => {
      setRunning(false)
      setLastExit(exit)
      if (savedPending) setPendingExperience(savedPending)
      else clearPendingExperience()
    },
    [savedPending],
  )

  if (!buildUrl) return <ErrorScreen title="백엔드 주소가 없어요" message="VITE_API_BASE_URL 이 설정된 배포(실제 백엔드 모드)에서 열어 주세요." />
  if (error) return <ErrorScreen title="3D 체험 테스트" message={error} />
  if (!rows)
    return (
      <div className="page-narrow work">
        <Spinner label="체험 목록을 불러오는 중" />
      </div>
    )

  return (
    <div className="page-narrow work">
      <p className="work-kicker">내부 테스트용 · 기록은 백엔드에 저장하지 않아요</p>
      <h1>3D 체험 테스트</h1>
      <p className="muted small">
        빌드 <code>{buildId}</code> · 체험 {rows.length}개 · <a href="/work/state">숨겨진 상태 보기</a>
      </p>
      {picked ? (
        <section className="card work-card" aria-label="고른 체험">
          <span className="job-kicker">
            {picked.roomId}
            {picked.roomName && ` · ${picked.roomName}`}
            {picked.jobs && picked.jobs.length > 0 && ` · ${picked.jobs.join(', ')}`}
          </span>
          <h2>{picked.title ?? picked.scenarioId}</h2>
          {picked.description && <p className="muted small">{picked.description}</p>}
          <p className="small muted">
            <code>
              {picked.scenarioId} {picked.scenarioVersion}
            </code>
          </p>
          <div className="row">
            <Button onClick={start}>체험 시작</Button>
            <Button variant="ghost" onClick={() => setPicked((current) => pickRandom(rows, current))}>
              다른 체험 고르기
            </Button>
          </div>
        </section>
      ) : (
        <p>이 빌드에 실행할 수 있는 체험이 없어요.</p>
      )}
      {lastExit && (
        <section className="work-log" aria-label="마지막 체험 결과">
          <h2>마지막 체험: {lastExit}</h2>
          {events.length === 0 ? (
            <p className="muted small">받은 이벤트가 없어요.</p>
          ) : (
            <ol>
              {events.map((event) => (
                <li key={`${event.sequence}-${event.type}`}>
                  <span className="muted">{event.at}</span> #{event.sequence} <code>{event.type}</code>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {running && offer && <ExperienceOverlay playId={TEST_PLAY_ID} sessionId={sessionId} offer={offer} onClose={close} api={api} />}
    </div>
  )
}
