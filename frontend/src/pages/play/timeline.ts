import type { ChatMessage, ExperienceOffer } from '../../types/api'

/** 대화 화면에 쌓이는 항목 */
export type TimelineItem =
  | { kind: 'message'; id: string; message: ChatMessage }
  | { kind: 'system'; id: string; text: string }
  | { kind: 'experience'; id: string; offer: ExperienceOffer; status: 'offered' | 'declined' | 'started' | 'done' }

let counter = 0
export const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`

export function messagesToTimeline(messages: ChatMessage[]): TimelineItem[] {
  return messages.map((message) => ({ kind: 'message', id: nextId('m'), message }))
}

/** 대기 중인 3D 안내 카드를 "다음에 하기로 했어요" 로 접는다 (05 화면 2) */
export function declineOpenOffers(items: TimelineItem[]): TimelineItem[] {
  return items.map((item) => (item.kind === 'experience' && item.status === 'offered' ? { ...item, status: 'declined' } : item))
}

/** "친구 민수" → "민" (아바타 글자) */
export function avatarLetter(speaker: string): string {
  const parts = speaker.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? '').charAt(0) || '?'
}
