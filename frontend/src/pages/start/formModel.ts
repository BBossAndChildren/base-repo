import type { StartPlayRequest } from '../../types/api'
import { AGE_MAX, AGE_MIN, NAME_MAX, SITUATIONS, type OptionalField } from './options'

export interface StartFormValues {
  name: string
  age: string
  situation: string
  hasDreamJob: boolean | null
  dreamJob: string
  gender: string
  interests: string[]
  majorOrGrade: string
  strengths: string[]
  values: string[]
  roleModel: string
  mbti: string
}

export const EMPTY_FORM: StartFormValues = {
  name: '',
  age: '',
  situation: '',
  hasDreamJob: null,
  dreamJob: '',
  gender: '',
  interests: [],
  majorOrGrade: '',
  strengths: [],
  values: [],
  roleModel: '',
  mbti: '',
}

export type StartFormErrors = Partial<Record<'name' | 'age' | 'situation' | 'hasDreamJob' | 'dreamJob', string>>

/** 필수 4개 확인 (03 1-2). 오류가 없으면 빈 객체 */
export function validateStartForm(values: StartFormValues): StartFormErrors {
  const errors: StartFormErrors = {}
  const name = values.name.trim()
  if (!name) errors.name = '이름을 적어 주세요.'
  else if (name.length > NAME_MAX) errors.name = `이름은 ${NAME_MAX}자까지 적을 수 있어요.`

  const age = Number(values.age)
  if (values.age.trim() === '') errors.age = '나이를 적어 주세요.'
  else if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) errors.age = `${AGE_MIN}~${AGE_MAX} 사이의 숫자로 입력해 주세요.`

  if (!(SITUATIONS as readonly string[]).includes(values.situation)) errors.situation = '지금 상황을 골라 주세요.'
  if (values.hasDreamJob === null) errors.hasDreamJob = '되고 싶은 직업이 있는지 골라 주세요.'
  else if (values.hasDreamJob && !values.dreamJob.trim()) errors.dreamJob = '되고 싶은 직업을 적어 주세요.'
  return errors
}

/**
 * 요청 본문 만들기. 화면에 보였고 건너뛰지 않았으며 값이 있는 선택 항목만 넣는다
 * (보여 주지 않은 · 건너뛴 항목은 필드를 생략 — 03 1-2)
 */
export function buildStartRequest(values: StartFormValues, answered: readonly OptionalField[]): StartPlayRequest {
  const body: StartPlayRequest = {
    name: values.name.trim(),
    age: Number(values.age),
    situation: values.situation,
    hasDreamJob: values.hasDreamJob === true,
  }
  if (values.hasDreamJob) body.dreamJob = values.dreamJob.trim()

  for (const field of answered) {
    const value = values[field]
    if (Array.isArray(value)) {
      if (value.length > 0) Object.assign(body, { [field]: [...value] })
    } else if (value.trim()) {
      Object.assign(body, { [field]: value.trim() })
    }
  }
  return body
}
