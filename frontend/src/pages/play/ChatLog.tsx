import { useEffect, useRef } from 'react'
import { Badge, Button, TypingIndicator } from '../../components'
import type { ExperienceOffer } from '../../types/api'
import { avatarLetter, type TimelineItem } from './timeline'

interface ChatLogProps {
  items: TimelineItem[]
  waiting: boolean
  onStartExperience: (id: string, offer: ExperienceOffer) => void
  onDeclineExperience: (id: string) => void
}

export function ChatLog({ items, waiting, onStartExperience, onDeclineExperience }: ChatLogProps) {
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [items.length, waiting])

  return (
    <ol className="chat-log" aria-live="polite" aria-relevant="additions" aria-label="대화">
      {items.map((item) => {
        if (item.kind === 'system')
          return (
            <li key={item.id} className="msg msg-system" role="note">
              {item.text}
            </li>
          )
        if (item.kind === 'experience') return <ExperienceItem key={item.id} item={item} onStart={onStartExperience} onDecline={onDeclineExperience} />
        const { role, speaker, text } = item.message
        if (role === 'narrator')
          return (
            <li key={item.id} className="msg msg-narrator">
              <span className="msg-speaker">나레이션</span>
              {text}
            </li>
          )
        if (role === 'user')
          return (
            <li key={item.id} className="msg msg-user">
              <span className="msg-speaker">나</span>
              <div className="bubble">{text}</div>
            </li>
          )
        return (
          <li key={item.id} className="msg msg-npc">
            <span className="avatar" aria-hidden="true">
              {avatarLetter(speaker)}
            </span>
            <div>
              <span className="msg-speaker">{speaker}</span>
              <div className="bubble">{text}</div>
            </div>
          </li>
        )
      })}
      {waiting && (
        <li className="msg msg-npc msg-loading">
          <div className="bubble">
            <TypingIndicator />
          </div>
        </li>
      )}
      <li ref={endRef} aria-hidden="true" style={{ height: 0 }} />
    </ol>
  )
}

function ExperienceItem({
  item,
  onStart,
  onDecline,
}: {
  item: Extract<TimelineItem, { kind: 'experience' }>
  onStart: (id: string, offer: ExperienceOffer) => void
  onDecline: (id: string) => void
}) {
  const { offer } = item
  if (item.status === 'declined')
    return (
      <li className="exp-card-declined" role="note">
        「{offer.title}」 체험은 다음에 하기로 했어요
      </li>
    )
  const titleId = `${item.id}-title`
  return (
    <li className="exp-card" aria-labelledby={titleId}>
      <div className="exp-card-art" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E9B949" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.6 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.6 6.2 20l1.6-6.6L2.6 8.9l6.8-.6z" />
        </svg>
      </div>
      <div>
        <span className="job-kicker">3D 직업 체험{offer.jobs.length > 0 && ` · ${offer.jobs.join(', ')}`}</span>
        <h3 id={titleId}>{offer.title}</h3>
        <p>{offer.reason}</p>
        <div className="exp-meta">
          <Badge>물건 3개</Badge>
          <Badge>효과음 있음</Badge>
        </div>
        {item.status === 'started' || item.status === 'done' ? (
          <p className="small muted">{item.status === 'done' ? '체험을 마쳤어요' : '체험하는 중이에요'}</p>
        ) : (
          <div className="row">
            <Button onClick={() => onStart(item.id, offer)}>체험 시작</Button>
            <Button variant="ghost" onClick={() => onDecline(item.id)}>
              다음에 할게요
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
