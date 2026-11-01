import type { PlayState } from '../../types/api'

/** 백엔드가 확정한 공개 사건 (03 턴 응답 events). facts 모양은 사건 종류마다 다르다 */
interface GameEvent {
  kind: string
  facts: Record<string, unknown>
}

const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

const ACTIVITY: Record<string, string> = {
  work: '일하며',
  overtime: '야근하며',
  holiday: '쉬며',
  vacation: '휴가를 보내며',
  study: '공부하며',
  jobSearch: '일자리를 찾으며',
  prepare: '준비하며',
  idle: '지내며',
}

function period(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365)
    const months = Math.round((days % 365) / 30)
    return months > 0 ? `${years}년 ${months}개월` : `${years}년`
  }
  if (days >= 30) return `${Math.round(days / 30)}개월`
  return `${days}일`
}

function toEvents(raw: unknown): GameEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const { kind, facts } = item as { kind?: unknown; facts?: unknown }
    if (typeof kind !== 'string') return []
    return [{ kind, facts: facts && typeof facts === 'object' ? (facts as Record<string, unknown>) : {} }]
  })
}

/** 사건 하나를 한 줄로. 화면에 따로 알릴 만한 것만 (그 밖은 null) */
function describe(event: GameEvent): string | null {
  const f = event.facts
  switch (event.kind) {
    case 'paymentDue': {
      const amount = num(f.amount)
      return amount !== undefined ? `${typeof f.creditor === 'string' ? f.creditor : '지출'} ${won(amount)}을 내지 못해 미납으로 남았어요` : null
    }
    case 'aging':
      return num(f.healthLoss) ? `나이가 들어 건강이 ${f.healthLoss} 줄었어요` : null
    case 'healthRecovered':
      return num(f.healthGain) ? `잘 쉬어서 건강이 ${f.healthGain} 회복됐어요` : null
    case 'highStress':
      return num(f.healthLoss) ? `스트레스가 계속 높아 건강이 ${f.healthLoss} 줄었어요` : null
    case 'collapse':
      return f.died ? null : '과로로 쓰러져 병원에서 회복했어요'
    case 'familyPressure':
      return '가족이 앞으로의 계획을 물었어요'
    case 'supportNotice': {
      const to = num(f.to)
      if (to === undefined) return null
      return to === 0 ? '다음 달부터 가족 지원이 끊겨요' : `다음 달부터 가족 지원이 월 ${won(to)}으로 바뀌어요`
    }
    case 'supportChanged': {
      const to = num(f.to)
      return to === undefined ? null : to === 0 ? '가족 지원이 끊겼어요' : `가족 지원이 월 ${won(to)}으로 바뀌었어요`
    }
    case 'loan':
      return num(f.amount) ? `${typeof f.creditor === 'string' ? `${f.creditor}에서 ` : ''}${won(f.amount as number)}을 빌렸어요` : null
    case 'repayment':
      return num(f.amount) ? `빚 ${won(f.amount as number)}을 갚았어요` : null
    case 'arrearPayment':
      return num(f.amount) ? `미납 ${won(f.amount as number)}을 냈어요` : null
    case 'acceptJob':
      return '새 일을 시작했어요'
    case 'acceptHousing':
      return '새 집으로 옮겼어요'
    case 'quitJob':
      return '하던 일을 그만뒀어요'
    default:
      return null
  }
}

/**
 * 턴의 공개 사건으로 경과 요약을 만든다 (05 9절: 일상 압축 뒤 경과 요약).
 * 시간이 흐른 턴이면 첫 줄에 기간 · 활동 · 월 정산 · 자금 변화 · 나이를, 이어서 주요 사건을 한 줄씩.
 */
export function summarizeTurn(rawEvents: unknown, before: PlayState | null, after: PlayState | undefined): { lines: string[]; timePassed: boolean } {
  const events = toEvents(rawEvents)
  const lines: string[] = []
  const passed = events.find((event) => event.kind === 'timePassed')
  if (passed) {
    const days = num(after?.elapsedDays) !== undefined && num(before?.elapsedDays) !== undefined ? (after!.elapsedDays as number) - (before!.elapsedDays as number) : num(passed.facts.requestedDays)
    const parts: string[] = []
    if (days !== undefined && days > 0) parts.push(`${period(days)} 동안 ${ACTIVITY[String(passed.facts.activity)] ?? '지내며'} 시간이 흘렀어요`)
    else parts.push('시간이 흘렀어요')
    const settlements = events.filter((event) => event.kind === 'monthlySettlement').length
    if (settlements > 0) parts.push(`월 정산 ${settlements}번`)
    const fundsBefore = num(before?.funds)
    const fundsAfter = num(after?.funds)
    if (fundsBefore !== undefined && fundsAfter !== undefined && fundsBefore !== fundsAfter) parts.push(`자금 ${won(fundsBefore)} → ${won(fundsAfter)}`)
    if (after && before && after.age !== before.age) parts.push(`${after.age}세`)
    lines.push(parts.join(' · '))
  }
  for (const event of events) {
    const line = describe(event)
    if (line) lines.push(line)
  }
  return { lines, timePassed: Boolean(passed) }
}
