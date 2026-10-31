import { describe, expect, it } from 'vitest'
import { EMPTY_FORM, buildStartRequest, validateStartForm, type StartFormValues } from './formModel'
import { OPTIONAL_FIELDS, pickOptionalFields } from './options'

const VALID: StartFormValues = { ...EMPTY_FORM, name: '민준', age: '15', situation: '중학생', hasDreamJob: false }

describe('validateStartForm', () => {
  it('필수 4개가 차면 오류 없음', () => {
    expect(validateStartForm(VALID)).toEqual({})
  })

  it('빈 폼은 필수 4개 모두 오류', () => {
    expect(Object.keys(validateStartForm(EMPTY_FORM)).sort()).toEqual(['age', 'hasDreamJob', 'name', 'situation'])
  })

  it.each(['6', '100', '15.5', 'abc'])('나이 %s 는 7~99 정수가 아니므로 오류', (age) => {
    expect(validateStartForm({ ...VALID, age }).age).toBe('7~99 사이의 숫자로 입력해 주세요.')
  })

  it('이름은 공백만 있으면 오류, 21자 이상이면 오류', () => {
    expect(validateStartForm({ ...VALID, name: '   ' }).name).toBeDefined()
    expect(validateStartForm({ ...VALID, name: '가'.repeat(21) }).name).toBeDefined()
  })

  it('보기에 없는 상황은 오류', () => {
    expect(validateStartForm({ ...VALID, situation: '우주인' }).situation).toBeDefined()
  })

  it('희망 직업이 있다고 하면 직업명이 필요하다', () => {
    expect(validateStartForm({ ...VALID, hasDreamJob: true }).dreamJob).toBe('되고 싶은 직업을 적어 주세요.')
    expect(validateStartForm({ ...VALID, hasDreamJob: true, dreamJob: '요리사' })).toEqual({})
  })
})

describe('buildStartRequest', () => {
  it('필수 값만 있으면 선택 항목 필드는 없다', () => {
    expect(buildStartRequest({ ...VALID, name: ' 민준 ' }, [])).toEqual({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
  })

  it('희망 직업이 없으면 적어 둔 직업명도 보내지 않는다', () => {
    expect(buildStartRequest({ ...VALID, dreamJob: '요리사' }, [])).not.toHaveProperty('dreamJob')
  })

  it('답한 선택 항목만 넣고, 빈 값 · 답하지 않은 항목은 넣지 않는다', () => {
    const values = { ...VALID, interests: ['과학'], values: [], mbti: 'INTP', roleModel: '  ' }
    const body = buildStartRequest(values, ['interests', 'values', 'roleModel'])
    expect(body.interests).toEqual(['과학'])
    expect(body).not.toHaveProperty('values')
    expect(body).not.toHaveProperty('roleModel')
    expect(body).not.toHaveProperty('mbti')
  })
})

describe('pickOptionalFields', () => {
  it('7개 중 서로 다른 2개를 고른다', () => {
    for (let i = 0; i < 50; i += 1) {
      const picked = pickOptionalFields()
      expect(picked).toHaveLength(2)
      expect(new Set(picked).size).toBe(2)
      picked.forEach((field) => expect(OPTIONAL_FIELDS).toContain(field))
    }
  })

  it('무작위 값에 따라 다른 조합이 나온다', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i += 1) seen.add(pickOptionalFields().join(','))
    expect(seen.size).toBeGreaterThan(5)
  })
})
