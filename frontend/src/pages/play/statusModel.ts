import type { NpcSummary, PlayState } from '../../types/api'

/**
 * 상태 패널 값 (05 화면 2 목표 상태 패널 · 03 게임 상태와 턴 확장).
 * 백엔드가 확정해 준 값만 쓰고, 없는 항목은 그리지 않는다
 */
export interface StatusValues {
  age: number
  /** 원화 자금 (0 이상) */
  funds?: number
  /** 원화 총부채 (0 이상, 0원도 표시) */
  debt?: number
  health?: number
  energy?: number
  stress?: number
  housing?: { type: string; monthlyRent: number; livingCost: number }
  development?: { kind: string; value: number | null }
  /** 월 수입: 월급(일하는 중일 때) + 가족 지원 */
  income?: number
  /** 주변 인물과의 관계 0~100 (05 화면 2: 관계는 인물별로) */
  people?: { id: string; name: string; value: number }[]
}

export type StatusField = keyof StatusValues

const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/** 백엔드 state → 화면 값. 형식이 다른 항목은 버린다 */
export function pickStatus(state: PlayState, npcs: NpcSummary[] = []): StatusValues {
  const housing = state.housing as Record<string, unknown> | undefined
  const development = state.development as Record<string, unknown> | undefined
  const occupation = state.occupation as Record<string, unknown> | undefined
  const support = state.support as Record<string, unknown> | undefined
  const salary = occupation?.status === 'employed' ? (num(occupation.monthlySalary) ?? 0) : 0
  const allowance = num(support?.monthlyAmount) ?? 0
  const names = new Map(npcs.map((npc) => [npc.id, npc.name]))
  const relationship = state.relationship && typeof state.relationship === 'object' ? state.relationship : {}
  const people = Object.entries(relationship)
    .filter((entry): entry is [string, number] => num(entry[1]) !== undefined)
    .map(([id, value]) => ({ id, name: names.get(id) ?? id, value }))
  return {
    age: state.age,
    funds: num(state.funds),
    debt: num(state.debt),
    health: num(state.health),
    energy: num(state.energy),
    stress: num(state.stress),
    housing:
      housing && typeof housing.type === 'string'
        ? { type: housing.type, monthlyRent: num(housing.monthlyRent) ?? 0, livingCost: num(housing.livingCost) ?? 0 }
        : undefined,
    development:
      development && typeof development.kind === 'string'
        ? { kind: development.kind, value: num(development.value) ?? null }
        : undefined,
    income: occupation || support ? salary + allowance : undefined,
    people: people.length > 0 ? people : undefined,
  }
}

/** stateChanges 의 field(예: "housing.monthlyRent") → 강조할 화면 항목 */
export function changedStatusFields(fields: string[]): StatusField[] {
  const known: StatusField[] = ['age', 'funds', 'debt', 'health', 'energy', 'stress', 'housing', 'development', 'people']
  // relationship.<npc> 변경은 "주변 인물" 영역을 강조한다
  const top = (field: string) => (field.startsWith('relationship') ? 'people' : (field.split('.')[0] as StatusField))
  return [...new Set(fields.map(top).filter((field) => known.includes(field)))]
}
