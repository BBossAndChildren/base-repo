import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PlayResume } from '../types/api'
import { HiddenState } from './WorkStatePage'

const play: PlayResume = {
  playId: 'p1',
  sessionId: 's1',
  ended: false,
  messages: [],
  npcs: [{ id: 'a', name: '친구 민수' }],
  pendingChoices: [{ kind: 'insufficientFunds', amount: 1000, options: ['지출 미루기'] }],
  state: {
    age: 25,
    funds: 100000,
    debt: 300000,
    relationship: { a: 62 },
    interests: { 과학: 4, 음악: null },
    support: { monthlyAmount: 200000, source: 'family' },
    debts: [{ id: 'd1', creditor: '은행', balance: 300000 }],
    arrears: [{ id: 'r1', creditor: '생활비', amount: 50000, gameDate: '2026-03-01' }],
    occupation: { status: 'searching', currentJob: null },
  },
}

describe('/work/state 숨겨진 상태 (#145)', () => {
  it('관계 · 흥미 · 빚 · 미납 · 가족 지원 · 대기 선택을 보여 준다', () => {
    render(<HiddenState play={play} />)
    const people = screen.getByRole('region', { name: '주변 인물 관계 (0~100)' })
    expect(within(people).getByText('친구 민수 (a)')).toBeInTheDocument()
    expect(within(people).getByText('62')).toBeInTheDocument()
    const interests = screen.getByRole('region', { name: '흥미 (1~5, 미확인은 —)' })
    expect(within(interests).getByText('4 · 높음')).toBeInTheDocument()
    expect(within(interests).getByText('미확인')).toBeInTheDocument()
    const money = screen.getByRole('region', { name: '돈' })
    expect(within(money).getByText('200,000원')).toBeInTheDocument()
    expect(within(money).getByText('300,000원 (d1)')).toBeInTheDocument()
    expect(within(money).getByText('50,000원')).toBeInTheDocument()
    expect(screen.getByText(/insufficientFunds/)).toBeInTheDocument()
  })
})
