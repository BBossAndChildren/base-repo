import type { PendingChoice } from '../../types/api'

const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`

const ACTIVITY: Record<string, string> = {
  work: '일하며',
  overtime: '야근하며',
  holiday: '쉬면서',
  vacation: '휴가를 보내며',
  study: '공부하며',
  jobSearch: '일자리를 찾으며',
  prepare: '준비하며',
  idle: '지내며',
}

const HOUSING: Record<string, string> = {
  monthlyRent: '월세',
  jeonse: '전세',
  owned: '자가',
  family: '가족과 함께 살기',
}

function period(days: number): string {
  if (days >= 365) return `약 ${Math.round(days / 365)}년`
  if (days >= 30) return `약 ${Math.round(days / 30)}개월`
  return `${days}일`
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** 백엔드가 기다리는 선택을 한 문장으로 (03 게임 상태와 턴 확장 · 05 9절: 고르기 전에 잔액 · 비용 영향을 알 수 있게) */
export function describeChoice(choice: PendingChoice): string {
  switch (choice.kind) {
    case 'insufficientFunds':
      return isNumber(choice.amount) ? `돈이 ${won(choice.amount)} 부족해요. 어떻게 할까요?` : '돈이 부족해요. 어떻게 할까요?'
    case 'confirmAdvance':
      return isNumber(choice.days) ? `${period(choice.days)} 동안 ${ACTIVITY[choice.activity ?? ''] ?? '지내며'} 시간을 보낼까요?` : '긴 시간을 넘길까요?'
    case 'offer': {
      const offer = choice.offer ?? {}
      if (offer.kind === 'job' && offer.job)
        return isNumber(offer.monthlySalary) ? `${offer.job} 자리 제안 · 월급 ${won(offer.monthlySalary)}` : `${offer.job} 자리 제안`
      if (offer.kind === 'housing') {
        const parts = [HOUSING[offer.type ?? ''] ?? '주거']
        if (isNumber(offer.deposit) && offer.deposit > 0) parts.push(`보증금 ${won(offer.deposit)}`)
        if (isNumber(offer.monthlyRent) && offer.monthlyRent > 0) parts.push(`월세 ${won(offer.monthlyRent)}`)
        if (isNumber(offer.livingCost)) parts.push(`생활비 ${won(offer.livingCost)}`)
        return `주거 제안 · ${parts.join(' · ')}`
      }
      if (offer.kind === 'loan' && isNumber(offer.amount)) return `${offer.creditor ?? ''} 대출 제안 · ${won(offer.amount)}`.replace(/^ /, '')
      return '제안이 왔어요. 어떻게 할까요?'
    }
    case 'familyPressure':
      return '가족이 앞으로의 계획을 묻고 있어요.'
    case 'hospitalRecovery':
      return '쓰러져 병원에서 회복했어요. 잠시 쉬어야 해요.'
    default:
      return '선택이 필요해요.'
  }
}

/** 서버 값이 예상과 달라도 화면이 깨지지 않게 보기 문자열이 있는 항목만 쓴다 */
export function usableChoices(raw: unknown): PendingChoice[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is PendingChoice =>
      typeof item === 'object' && item !== null && typeof (item as PendingChoice).kind === 'string' && Array.isArray((item as PendingChoice).options) && (item as PendingChoice).options.every((option) => typeof option === 'string'),
  )
}
