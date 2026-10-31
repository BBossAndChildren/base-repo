import type { PlayState } from '../../types/api'

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
}

export type StatusField = keyof StatusValues

const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/** 백엔드 state → 화면 값. 형식이 다른 항목은 버린다 */
export function pickStatus(state: PlayState): StatusValues {
  const housing = state.housing as Record<string, unknown> | undefined
  const development = state.development as Record<string, unknown> | undefined
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
  }
}

/** stateChanges 의 field(예: "housing.monthlyRent") → 강조할 화면 항목 */
export function changedStatusFields(fields: string[]): StatusField[] {
  const known: StatusField[] = ['age', 'funds', 'debt', 'health', 'energy', 'stress', 'housing', 'development']
  return [...new Set(fields.map((field) => field.split('.')[0] as StatusField).filter((field) => known.includes(field)))]
}
