import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, gameApi } from '../../api'
import { usePlayer } from '../../app/playerContext'
import { useToast } from '../../components'
import type { ExperienceOffer, PlayResume, TurnResponse } from '../../types/api'
import { ChatLog } from './ChatLog'
import { Composer } from './Composer'
import { StatusBar, StatusPanel } from './StatusPanel'
import { declineOpenOffers, messagesToTimeline, nextId, type TimelineItem } from './timeline'

const AGE_HIGHLIGHT_MS = 1600

interface PlayViewProps {
  play: PlayResume
  /** 3D 체험 시작 (8단계에서 체험 화면을 연다) */
  onStartExperience?: (offer: ExperienceOffer) => void
}

/** 화면 2: 게임 (05-ui-ux.md 화면 2) */
export function PlayView({ play, onStartExperience }: PlayViewProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const { resetPlayer } = usePlayer()
  const [items, setItems] = useState<TimelineItem[]>(() => messagesToTimeline(play.messages))
  const [age, setAge] = useState(play.state.age)
  const [ageChanged, setAgeChanged] = useState(false)
  const [hints, setHints] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [ended, setEnded] = useState(play.ended)

  useEffect(() => {
    if (!ageChanged) return
    const timer = setTimeout(() => setAgeChanged(false), AGE_HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [ageChanged])

  function applyTurn(turn: TurnResponse) {
    const added: TimelineItem[] = messagesToTimeline(turn.messages)
    for (const change of turn.stateChanges) {
      if (change.field === 'age' && typeof change.to === 'number') {
        setAge(change.to)
        setAgeChanged(true)
        added.push({ kind: 'system', id: nextId('s'), text: `시간이 흘렀어요 · ${change.to}세` })
      }
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
    else toast.show({ message: '3D 체험 화면을 준비하고 있어요.' })
  }

  function declineExperience(id: string) {
    setItems((prev) => prev.map((item) => (item.id === id && item.kind === 'experience' ? { ...item, status: 'declined' } : item)))
  }

  return (
    <>
      <StatusBar age={age} ageChanged={ageChanged} />
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
        <StatusPanel age={age} ageChanged={ageChanged} />
      </div>
    </>
  )
}
