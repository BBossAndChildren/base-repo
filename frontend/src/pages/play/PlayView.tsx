import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, gameApi } from '../../api'
import { DEFAULT_ERROR_MESSAGES } from '../../api/errors'
import { usePlayer } from '../../app/playerContext'
import { Button, useToast } from '../../components'
import type { ExperienceOffer, ExperienceSuggestion, NpcSummary, PendingChoice, PlayResume, PlayState, TurnResponse } from '../../types/api'
import { ChatLog } from './ChatLog'
import { ExperienceCard } from './ExperienceCard'
import { ExperienceOverlay } from './ExperienceOverlay'
import type { ExperienceExit } from './experienceMessages'
import { Composer } from './Composer'
import { StatusBar, StatusPanel } from './StatusPanel'
import { changedStatusFields, pickStatus, type StatusField, type StatusValues } from './statusModel'
import { summarizeTurn } from './elapsed'
import { usableChoices } from './pendingChoices'
import { declineOpenOffers, messagesToTimeline, nextId, type TimelineItem } from './timeline'

const CHANGE_HIGHLIGHT_MS = 1600

const NO_CHANGES: ReadonlySet<StatusField> = new Set()

/** 이 오류 뒤에 같은 문장을 다시 보내면 같은 requestId 를 쓴다 (서버가 저장한 결과를 주거나 다시 처리). REQUEST_CONFLICT 만 새 ID */
const KEEP_REQUEST_ID = new Set(['TIMEOUT', 'NETWORK', 'AI_UNAVAILABLE', 'TURN_IN_PROGRESS', 'STATE_CONFLICT', 'PLAY_PAUSED', 'CONTENT_UNAVAILABLE', 'UNKNOWN'])

interface PlayViewProps {
  play: PlayResume
  /** 3D 체험 시작. 넘기지 않으면 체험 화면(ExperienceOverlay)을 연다 (테스트에서 바꿔 끼운다) */
  onStartExperience?: (offer: ExperienceOffer) => void
}

const EXIT_NOTE: Record<ExperienceExit, string | null> = {
  completed: '체험을 끝까지 마쳤어요. 이야기로 돌아왔어요.',
  aborted: '체험을 중간에 마쳤어요. 이야기로 돌아왔어요.',
  failed: '체험을 마쳤어요. 이야기로 돌아왔어요.',
  pending: '체험을 마쳤어요. 이야기로 돌아왔어요.',
  error: '3D 체험을 종료하고 이야기로 돌아왔어요.',
  skipped: null,
}

const WIDE_QUERY = '(min-width: 1024px)'
/** 체험 카드에서 시작한 체험 (대화 안 안내 카드가 아님) */
const CARD_EXPERIENCE = 'experience-card'

/** 넓은 화면(상태 패널) · 좁은 화면(접이식 막대) 중 한 곳에만 체험 카드를 그린다 (3D 모델을 두 번 받지 않게) */
function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia?.(WIDE_QUERY).matches ?? true)
  useEffect(() => {
    const query = window.matchMedia?.(WIDE_QUERY)
    if (!query) return
    const update = () => setWide(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

/** 화면 2: 게임 (05-ui-ux.md 화면 2) */
export function PlayView({ play, onStartExperience }: PlayViewProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const { resetPlayer } = usePlayer()
  const [items, setItems] = useState<TimelineItem[]>(() => messagesToTimeline(play.messages))
  // 관계를 이름으로 보여 주기 위한 만난 인물 목록 (턴마다 갱신)
  const npcsRef = useRef<NpcSummary[]>(play.npcs ?? [])
  // 경과 요약에서 이번 턴 전 · 후를 비교하기 위한 마지막 확정 상태
  const stateRef = useRef<PlayState | null>(play.state)
  const [status, setStatus] = useState<StatusValues>(() => pickStatus(play.state, play.npcs ?? []))
  const [changed, setChanged] = useState<ReadonlySet<StatusField>>(NO_CHANGES)
  const [hints, setHints] = useState<string[]>(play.hints ?? [])
  const [choices, setChoices] = useState<PendingChoice[]>(() => usableChoices(play.pendingChoices))
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [ended, setEnded] = useState(play.ended)
  const [paused, setPaused] = useState(play.paused === true)
  const [pausing, setPausing] = useState(false)
  const [activeExperience, setActiveExperience] = useState<{ cardId: string; offer: ExperienceOffer } | null>(null)
  // 실패한 문장과 그때의 requestId. 같은 문장을 다시 보내면 재사용한다 (05 화면 2)
  const failedRequest = useRef<{ message: string; requestId: string } | null>(null)
  // 상태 패널 아래 3D 체험 카드 (AI 분기 없이 언제든, 12 결정 31). 다시 고를 때 이미 보여 준 체험은 뺀다
  const wide = useWideScreen()
  const [suggestion, setSuggestion] = useState<ExperienceSuggestion | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestFailed, setSuggestFailed] = useState(false)
  const shownRef = useRef<string[]>([])

  async function loadSuggestion(shuffle: boolean) {
    setSuggesting(true)
    setSuggestFailed(false)
    try {
      const next = await gameApi.suggestExperience(play.playId, shuffle ? shownRef.current : [])
      shownRef.current = [...new Set([...shownRef.current, next.scenarioId])]
      setSuggestion(next)
    } catch {
      setSuggestFailed(true)
    } finally {
      setSuggesting(false)
    }
  }

  // 처음 들어왔을 때 · 일시정지를 풀었을 때 카드가 비어 있으면 하나 받는다
  useEffect(() => {
    if (ended || paused || suggestion || suggesting || suggestFailed) return
    void loadSuggestion(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, paused])

  useEffect(() => {
    if (changed.size === 0) return
    const timer = setTimeout(() => setChanged(NO_CHANGES), CHANGE_HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [changed])

  function applyTurn(turn: TurnResponse) {
    // 시간이 흐른 턴이면 무엇이 달라졌는지 먼저 짧게 요약한다 (05 9절 경과 요약, #147)
    const summary = summarizeTurn(turn.events, stateRef.current, turn.state)
    const added: TimelineItem[] = summary.lines.map((text) => ({ kind: 'system', id: nextId('s'), text }))
    added.push(...messagesToTimeline(turn.messages))
    const updates: Partial<Record<StatusField, number>> = {}
    for (const change of turn.stateChanges) {
      if (change.field.includes('.') || typeof change.to !== 'number') continue
      updates[change.field as StatusField] = change.to
      if (change.field === 'age' && !summary.timePassed) added.push({ kind: 'system', id: nextId('s'), text: `시간이 흘렀어요 · ${change.to}세` })
    }
    if (turn.state) stateRef.current = turn.state
    const changedFields = changedStatusFields(turn.stateChanges.map((change) => change.field))
    // 턴 응답의 state 가 백엔드 확정 값이다. 없을 때(이전 형식)만 stateChanges 로 맞춘다
    if (turn.npcs) npcsRef.current = turn.npcs
    if (turn.state) setStatus(pickStatus(turn.state, npcsRef.current))
    else if (Object.keys(updates).length > 0) setStatus((prev) => ({ ...prev, ...updates }) as StatusValues)
    if (changedFields.length > 0) setChanged(new Set(changedFields))
    if (turn.experience) added.push({ kind: 'experience', id: nextId('e'), offer: turn.experience, status: 'offered' })
    if (turn.notice) toast.show({ message: turn.notice.message })
    // 다음 행동이 확정된 뒤에만 이전 체험 제안을 접는다
    setItems((prev) => [...declineOpenOffers(prev), ...added])
    setHints(turn.hints)
    setChoices(usableChoices(turn.pendingChoices))
    if (turn.ended) setEnded(true)
  }

  async function send() {
    const message = draft.trim()
    if (!message || waiting || ended) return
    const pendingId = nextId('u')
    setItems((prev) => [...prev, { kind: 'message', id: pendingId, message: { role: 'user', speaker: '나', text: message } }])
    setDraft('')
    const previousChoices = choices
    setChoices([])
    setWaiting(true)
    const requestId = failedRequest.current?.message === message ? failedRequest.current.requestId : crypto.randomUUID()
    try {
      applyTurn(await gameApi.sendTurn(play.playId, { requestId, message }))
      failedRequest.current = null
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
      // 보내지 못한 말은 화면에서 빼고 입력칸에 되돌린다 (05 6절: 입력한 내용은 지우지 않는다)
      setItems((prev) => prev.filter((item) => item.id !== pendingId))
      setDraft(message)
      setChoices(previousChoices)
      failedRequest.current = KEEP_REQUEST_ID.has(apiError.type) ? { message, requestId } : null
      if (apiError.type === 'STATE_CONFLICT') {
        toast.show({ type: 'error', message: apiError.message })
        await reloadLatest()
        return
      }
      if (apiError.type === 'PLAY_PAUSED') setPaused(true)
      if (apiError.type === 'ALREADY_ENDED') {
        navigate(`/play/${play.playId}/result`, { replace: true })
        return
      }
      if (apiError.type === 'UNKNOWN_PLAYER') {
        void resetPlayer()
        return
      }
      // Cloudflare 가 서버의 502 · 504(AI 실패 · 시간 초과)를 자체 오류 페이지로 바꿔 브라우저에는 네트워크 오류로 보인다.
      // 채팅 중에는 응답 지연으로 안내한다 (05 5절, 11 E3 결정)
      const shown = apiError.type === 'NETWORK' ? DEFAULT_ERROR_MESSAGES.TIMEOUT : apiError.message
      toast.show({ type: 'error', message: shown })
    } finally {
      setWaiting(false)
    }
  }

  /** 일시정지 · 이어 하기 (PATCH /api/v1/plays/{playId}, 05 화면 2) */
  async function togglePause(next: boolean) {
    if (pausing) return
    setPausing(true)
    try {
      const result = await gameApi.setPaused(play.playId, next)
      setPaused(result.paused)
      stateRef.current = result.state
      setStatus(pickStatus(result.state, npcsRef.current))
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
      if (apiError.type === 'ALREADY_ENDED') {
        navigate(`/play/${play.playId}/result`, { replace: true })
        return
      }
      if (apiError.type === 'UNKNOWN_PLAYER') {
        void resetPlayer()
        return
      }
      toast.show({ type: 'error', message: apiError.message })
    } finally {
      setPausing(false)
    }
  }

  /** STATE_CONFLICT: 대화 · 상태를 서버의 최신 값으로 바꾼다 (입력 문장은 그대로) */
  async function reloadLatest() {
    try {
      const latest = await gameApi.getPlay(play.playId)
      setItems(messagesToTimeline(latest.messages))
      if (latest.npcs) npcsRef.current = latest.npcs
      stateRef.current = latest.state
      setStatus(pickStatus(latest.state, npcsRef.current))
      setHints(latest.hints ?? [])
      setChoices(usableChoices(latest.pendingChoices))
      setEnded(latest.ended)
    } catch {
      // 다시 조회하지 못하면 지금 화면을 유지한다. 다음 전송에서 다시 안내된다
    }
  }

  function startExperience(id: string, offer: ExperienceOffer) {
    setItems((prev) => prev.map((item) => (item.id === id && item.kind === 'experience' ? { ...item, status: 'started' } : item)))
    if (onStartExperience) onStartExperience(offer)
    else setActiveExperience({ cardId: id, offer })
  }

  /** 체험 카드에서 시작: 채팅 분기와 같은 3D 체험 화면 (백엔드가 추천을 기록해 이벤트를 받는다, 03 1-11) */
  function startSuggested(offer: ExperienceSuggestion) {
    setItems((prev) => [...prev, { kind: 'system', id: nextId('s'), text: `「${offer.title}」 3D 체험을 시작했어요` }])
    if (onStartExperience) onStartExperience(offer)
    else setActiveExperience({ cardId: CARD_EXPERIENCE, offer })
  }

  function closeExperience(exit: ExperienceExit) {
    const cardId = activeExperience?.cardId
    setActiveExperience(null)
    // 카드로 한 체험이 끝나면 다음 체험을 새로 고른다 (해 본 체험은 백엔드가 뺀다)
    if (cardId === CARD_EXPERIENCE && exit !== 'skipped') void loadSuggestion(false)
    // 체험을 하지 못했으면(불러오기 실패 · 건너뛰기) 카드를 "다음에 하기로 했어요" 로, 했으면 "마쳤어요" 로
    const status: 'declined' | 'done' = exit === 'skipped' ? 'declined' : 'done'
    setItems((prev) => {
      const next = prev.map((item) => (item.id === cardId && item.kind === 'experience' ? { ...item, status } : item))
      const note = EXIT_NOTE[exit]
      return note ? [...next, { kind: 'system', id: nextId('s'), text: note }] : next
    })
  }

  function declineExperience(id: string) {
    setItems((prev) => prev.map((item) => (item.id === id && item.kind === 'experience' ? { ...item, status: 'declined' } : item)))
  }

  const pauseAction =
    ended || paused ? null : (
      <Button variant="ghost" size="sm" onClick={() => void togglePause(true)} disabled={pausing || waiting}>
        일시정지
      </Button>
    )

  const experienceCard = ended ? null : (
    <ExperienceCard
      suggestion={suggestion}
      loading={suggesting}
      failed={suggestFailed}
      disabled={waiting || paused || activeExperience !== null}
      onStart={startSuggested}
      onShuffle={() => void loadSuggestion(suggestion !== null)}
    />
  )

  return (
    <>
      <StatusBar values={status} changed={changed} actions={pauseAction} extra={wide ? null : experienceCard} />
      <div className="play">
        <section className="chat" aria-label="이야기">
          <ChatLog items={items} waiting={waiting} onStartExperience={startExperience} onDeclineExperience={declineExperience} />
          {ended ? (
            <div className="chat-footer">
              <div className="chat-ended" role="status">
                <p>이번 인생의 이야기가 끝났어요.</p>
                <Link className="btn btn-primary" to={`/play/${play.playId}/result`}>
                  결말 보기
                </Link>
              </div>
            </div>
          ) : paused ? (
            <div className="chat-footer">
              <div className="chat-ended" role="status">
                <p>일시정지 중이에요. 이어 하려면 아래 버튼을 눌러 주세요.</p>
                <Button onClick={() => void togglePause(false)} disabled={pausing}>
                  이어 하기
                </Button>
              </div>
            </div>
          ) : (
            <Composer value={draft} onChange={setDraft} onSubmit={() => void send()} hints={hints} choices={choices} disabled={waiting} waiting={waiting} />
          )}
        </section>
        <div className="play-side">
          <StatusPanel values={status} changed={changed} actions={pauseAction} />
          {wide && experienceCard}
        </div>
      </div>
      {activeExperience && <ExperienceOverlay playId={play.playId} sessionId={play.sessionId} offer={activeExperience.offer} onClose={closeExperience} />}
    </>
  )
}
