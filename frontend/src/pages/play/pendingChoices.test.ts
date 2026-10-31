import { describe, expect, it } from 'vitest'
import { describeChoice, usableChoices } from './pendingChoices'

describe('대기 중인 선택 (#134)', () => {
  it('잔액 부족은 부족한 금액을 원화로 보여 준다', () => {
    expect(describeChoice({ kind: 'insufficientFunds', amount: 300000, options: ['대출 알아보기'] })).toBe('돈이 300,000원 부족해요. 어떻게 할까요?')
  })

  it('긴 기간 진행 확인은 기간과 활동을 보여 준다', () => {
    expect(describeChoice({ kind: 'confirmAdvance', days: 730, activity: 'work', options: ['기간 진행 확인'] })).toBe('약 2년 동안 일하며 시간을 보낼까요?')
  })

  it('제안은 조건(월급 · 보증금 · 월세 · 대출액)을 보여 준다', () => {
    expect(describeChoice({ kind: 'offer', options: ['수락'], offer: { kind: 'job', job: '사서', monthlySalary: 2500000 } })).toBe('사서 자리 제안 · 월급 2,500,000원')
    expect(describeChoice({ kind: 'offer', options: ['수락'], offer: { kind: 'housing', type: 'monthlyRent', deposit: 5000000, monthlyRent: 400000, livingCost: 600000 } })).toBe(
      '주거 제안 · 월세 · 보증금 5,000,000원 · 월세 400,000원 · 생활비 600,000원',
    )
    expect(describeChoice({ kind: 'offer', options: ['수락'], offer: { kind: 'loan', amount: 1000000, creditor: '은행' } })).toBe('은행 대출 제안 · 1,000,000원')
  })

  it('서버 값이 예상과 다르면 보기 문자열이 있는 항목만 쓴다', () => {
    expect(usableChoices(null)).toEqual([])
    expect(usableChoices([{ kind: 'familyPressure', options: ['상황 설명'] }, { kind: 'x' }, 'bad', { kind: 'y', options: [1] }])).toEqual([{ kind: 'familyPressure', options: ['상황 설명'] }])
  })
})
