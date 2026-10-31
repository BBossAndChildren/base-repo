import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, gameApi } from '../../api'
import { usePlayer } from '../../app/playerContext'
import { useToast } from '../../components'
import type { ExperienceOffer, PlayResume, TurnResponse } from '../../types/api'
import { ChatLog } from './ChatLog'
import { ExperienceOverlay } from './ExperienceOverlay'
import type { ExperienceExit } from './experienceMessages'
import { Composer } from './Composer'
import { StatusBar, StatusPanel, type StatusField, type StatusValues } from './StatusPanel'
import { declineOpenOffers, messagesToTimeline, nextId, type TimelineItem } from './timeline'

const CHANGE_HIGHLIGHT_MS = 1600

const STATUS_FIELDS: StatusField[] = ['age', 'funds', 'energy']

function pickStatus(state: PlayResume['state']): StatusValues {
  return {
    age: state.age,
    funds: typeof state.funds === 'number' ? state.funds : undefined,
    energy: typeof state.energy === 'number' ? state.energy : undefined,
  }
}

const NO_CHANGES: ReadonlySet<StatusField> = new Set()

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

/** 화면 2: 게임 (05-ui-ux.md 화면 2) */
export function PlayView({ play, onStartExperience }: PlayViewProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const { resetPlayer } = usePlayer()
  const [items, setItems] = useState<TimelineItem[]>(() => messagesToTimeline(play.messages))
  const [status, setStatus] = useState<StatusValues>(() => pickStatus(play.state))
  const [changed, setChanged] = useState<ReadonlySet<StatusField>>(NO_CHANGES)
  const [hints, setHints] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [ended, setEnded] = useState(play.ended)
  const [activeExperience, setActiveExperience] = useState<{ cardId: string; offer: ExperienceOffer } | null>(null)

  useEffect(() => {
    if (changed.size === 0) return
    const timer = setTimeout(() => setChanged(NO_CHANGES), CHANGE_HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [changed])

  function applyTurn(turn: TurnResponse) {
    const added: TimelineItem[] = messagesToTimeline(turn.messages)
    const updates: Partial<StatusValues> = {}
    for (const change of turn.stateChanges) {
      const field = change.field as StatusField
      if (!STATUS_FIELDS.includes(field) || typeof change.to !== 'number') continue
      updates[field] = change.to
      if (field === 'age') added.push({ kind: 'system', id: nextId('s'), text: `시간이 흘렀어요 · ${change.to}세` })
    }
    const changedFields = Object.keys(updates) as StatusField[]
    if (changedFields.length > 0) {
      setStatus((prev) => ({ ...prev, ...updates }))
      setChanged(new Set(changedFields))
    }
    if (turn.experience) added.push({ kind: 'experience', id: nextId('e'), offer: turn.experience, status: 'offered' })
    if (turn.notice) toast.show({ message: turn.notice.message })
    setItems((prev) => [...prev, ...added])
    setHints(turn.hints)
    if (turn.ended) setEnded(true)
  }

  async function send() {
    const message = draft.trim()
    if (!message || waiting || ended) return
    const pendingId = nextId('u')
    // 안내 카드를 두고 계속 입력하면 체험을 하지 않은 것으로 본다 (05 화면 2)
    setItems((prev) => [...declineOpenOffers(prev), { kind: 'message', id: pendingId, message: { role: 'user', speaker: '나', text: message } }])
    setDraft('')
    setHints([])
    setWaiting(true)
    try {
      applyTurn(await gameApi.sendTurn(play.playId, { message }))
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
      // 보내지 못한 말은 화면에서 빼고 입력칸에 되돌린다 (05 6절: 입력한 내용은 지우지 않는다)
      setItems((prev) => prev.filter((item) => item.id !== pendingId))
      setDraft(message)
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
      setWaiting(false)
    }
  }

  function startExperience(id: string, offer: ExperienceOffer) {
    setItems((prev) => prev.map((item) => (item.id === id && item.kind === 'experience' ? { ...item, status: 'started' } : item)))
    if (onStartExperience) onStartExperience(offer)
    else setActiveExperience({ cardId: id, offer })
  }

  function closeExperience(exit: ExperienceExit) {
    const cardId = activeExperience?.cardId
    setActiveExperience(null)
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

  return (
    <>
      <StatusBar values={status} changed={changed} />
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
          ) : (
            <Composer value={draft} onChange={setDraft} onSubmit={() => void send()} hints={hints} disabled={waiting} waiting={waiting} />
          )}
        </section>
        <StatusPanel values={status} changed={changed} />
      </div>
      {activeExperience && <ExperienceOverlay playId={play.playId} sessionId={play.sessionId} offer={activeExperience.offer} onClose={closeExperience} />}
    </>
  )
}
