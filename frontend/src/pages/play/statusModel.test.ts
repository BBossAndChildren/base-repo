import { describe, expect, it } from 'vitest'
import { changedStatusFields, pickStatus } from './statusModel'

describe('상태 패널 값 (#145)', () => {
  it('관계는 만난 인물 이름으로, 이름을 모르면 식별자로 보여 준다', () => {
    const status = pickStatus({ age: 15, relationship: { a: 55, b: 40, z: 'x' as unknown as number } }, [{ id: 'a', name: '친구 민수' }])
    expect(status.people).toEqual([
      { id: 'a', name: '친구 민수', value: 55 },
      { id: 'b', name: 'b', value: 40 },
    ])
  })

  it('월 수입은 일하는 중의 월급과 가족 지원을 더한다', () => {
    expect(pickStatus({ age: 30, occupation: { status: 'employed', monthlySalary: 2156880 }, support: { monthlyAmount: 0 } }).income).toBe(2156880)
    expect(pickStatus({ age: 15, occupation: { status: 'student', monthlySalary: null }, support: { monthlyAmount: 50000 } }).income).toBe(50000)
    expect(pickStatus({ age: 15 }).income).toBeUndefined()
  })

  it('relationship.* 변경은 주변 인물 영역을 강조한다', () => {
    expect(changedStatusFields(['relationship.a', 'funds', 'interests.과학'])).toEqual(['people', 'funds'])
  })
})
