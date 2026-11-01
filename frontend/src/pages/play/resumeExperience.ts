import type { PendingExperience } from '../../lib/pendingExperience'
import type { PlayResume } from '../../types/api'
import { messagesToTimeline, nextId, type TimelineItem } from './timeline'

/** 재개는 서버가 준 미시작 제안만 복원한다. 결과나 진행 중 체험을 새 제안으로 만들지 않는다 */
export function resumeTimeline(play: PlayResume, pending: PendingExperience | null): TimelineItem[] {
  const items = messagesToTimeline(play.messages)
  const offer = play.experience
  if (!offer || play.ended) return items
  const state = play.experienceState
  if (state && (state.offerId !== offer.offerId || state.lifecycleStatus !== 'offered' || state.experienceId !== null || state.outcome !== null)) return items
  if (offer.offerId && play.lastTurnId && offer.offerId !== play.lastTurnId) return items
  if (offer.offerId && pending?.offerId === offer.offerId && pending.playId === play.playId && pending.sessionId === play.sessionId) return items
  return [...items, { kind: 'experience', id: nextId('e'), offer, status: 'offered' }]
}
