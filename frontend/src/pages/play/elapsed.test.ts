import { describe, expect, it } from 'vitest'
import { summarizeTurn } from './elapsed'

const ev = (kind: string, facts: Record<string, unknown> = {}) => ({ id: kind, kind, gameDate: '2026-04-01', facts })

describe('경과 요약 (#147)', () => {
  it('기간 · 활동 · 월 정산 · 자금 변화 · 나이를 한 줄로', () => {
    const { lines, timePassed } = summarizeTurn(
      [ev('monthlySettlement'), ev('monthlySettlement'), ev('monthlySettlement'), ev('timePassed', { requestedDays: 90, activity: 'work' })],
      { age: 29, elapsedDays: 10, funds: 1000000 },
      { age: 30, elapsedDays: 100, funds: 2500000 },
    )
    expect(timePassed).toBe(true)
    expect(lines[0]).toBe('3개월 동안 일하며 시간이 흘렀어요 · 월 정산 3번 · 자금 1,000,000원 → 2,500,000원 · 30세')
  })

  it('중간에 멈추면 실제로 지난 기간을 쓰고, 주요 사건을 한 줄씩 덧붙인다', () => {
    const { lines } = summarizeTurn(
      [
        ev('monthlySettlement'),
        ev('paymentDue', { creditor: '생활비', amount: 200000 }),
        ev('supportNotice', { from: 50000, to: 0 }),
        ev('aging', { age: 66, healthLoss: 3 }),
        ev('healthRecovered', { healthGain: 2 }),
        ev('timePassed', { requestedDays: 365, activity: 'idle' }),
      ],
      { age: 65, elapsedDays: 0, funds: 0 },
      { age: 65, elapsedDays: 31, funds: 0 },
    )
    expect(lines).toEqual([
      '1개월 동안 지내며 시간이 흘렀어요 · 월 정산 1번',
      '생활비 200,000원을 내지 못해 미납으로 남았어요',
      '다음 달부터 가족 지원이 끊겨요',
      '나이가 들어 건강이 3 줄었어요',
      '잘 쉬어서 건강이 2 회복됐어요',
    ])
  })

  it('시간이 흐르지 않은 턴은 주요 사건만, 사건이 없거나 형식이 이상하면 빈 요약', () => {
    expect(summarizeTurn([ev('loan', { amount: 1000000, creditor: '은행' })], null, undefined)).toEqual({ lines: ['은행에서 1,000,000원을 빌렸어요'], timePassed: false })
    expect(summarizeTurn(undefined, null, undefined)).toEqual({ lines: [], timePassed: false })
    expect(summarizeTurn([{ nope: 1 }, 'x', ev('offer')], null, undefined).lines).toEqual([])
  })
})
