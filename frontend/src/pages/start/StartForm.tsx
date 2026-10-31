import { useMemo, useState, type FormEvent } from 'react'
import { ApiError, gameApi } from '../../api'
import { Button, ChipGroup, Segmented, SelectField, TagInput, TextField, useToast } from '../../components'
import type { StartPlayResponse } from '../../types/api'
import {
  AGE_MAX,
  AGE_MIN,
  GENDERS,
  INTERESTS,
  MAX_INTERESTS,
  MAX_STRENGTHS,
  MAX_VALUES,
  MBTI_TYPES,
  NAME_MAX,
  OPTIONAL_LABELS,
  SITUATIONS,
  VALUES,
  pickOptionalFields,
  type OptionalField,
} from './options'
import { EMPTY_FORM, buildStartRequest, validateStartForm, type StartFormErrors, type StartFormValues } from './formModel'

interface StartFormProps {
  onStarted: (play: StartPlayResponse) => void
  /** 보여 줄 선택 항목. 기본은 7개 중 무작위 2개 (테스트에서 고정) */
  optionalFields?: OptionalField[]
  /** 서버가 모르는 게스트(401)일 때. 게스트 ID 재발급 후 시작 화면 (05-ui-ux.md 5절) */
  onUnknownPlayer?: () => void
}

const HINTS: Partial<Record<OptionalField, string>> = {
  interests: '여러 개 고를 수 있어요',
  values: `최대 ${MAX_VALUES}개`,
  strengths: `최대 ${MAX_STRENGTHS}개`,
}

/** 화면 1 시작 입력 (05-ui-ux.md 화면 1, 03 1-2) */
export function StartForm({ onStarted, optionalFields, onUnknownPlayer }: StartFormProps) {
  const toast = useToast()
  const shown = useMemo(() => optionalFields ?? pickOptionalFields(), [optionalFields])
  const [values, setValues] = useState<StartFormValues>(EMPTY_FORM)
  const [skipped, setSkipped] = useState<OptionalField[]>([])
  const [blurred, setBlurred] = useState<Array<keyof StartFormErrors>>([])
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const errors: StartFormErrors = validateStartForm(values)
  const isValid = Object.keys(errors).length === 0
  // 칸을 한 번 벗어난 뒤에만 오류를 보여 준다 (입력 중에 오류가 먼저 뜨지 않게)
  const visibleErrors: StartFormErrors = Object.fromEntries(Object.entries(errors).filter(([key]) => blurred.includes(key as keyof StartFormErrors)))
  const markBlurred = (key: keyof StartFormErrors) => () => setBlurred((prev) => (prev.includes(key) ? prev : [...prev, key]))

  function update<K extends keyof StartFormValues>(key: K, value: StartFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function toggleSkip(field: OptionalField) {
    setSkipped((prev) => (prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    setServerError(null)
    try {
      const answered = shown.filter((field) => !skipped.includes(field))
      onStarted(await gameApi.startPlay(buildStartRequest(values, answered)))
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
      if (apiError.type === 'INVALID_INPUT') setServerError(apiError.message)
      else toast.show({ type: 'error', message: apiError.message })
      setSubmitting(false)
      if (apiError.type === 'UNKNOWN_PLAYER') onUnknownPlayer?.()
    }
  }

  function renderOptional(field: OptionalField) {
    switch (field) {
      case 'gender':
        return <SelectField label={OPTIONAL_LABELS.gender} hideLabel options={GENDERS} placeholder="선택해 주세요" value={values.gender} onChange={(e) => update('gender', e.target.value)} />
      case 'interests': {
        const custom = values.interests.filter((item) => !(INTERESTS as readonly string[]).includes(item))
        return (
          <>
            <ChipGroup label="관심사" options={[...INTERESTS, ...custom]} selected={values.interests} onChange={(next) => update('interests', next)} max={MAX_INTERESTS} />
            {values.interests.length < MAX_INTERESTS && (
              <TagInput label="관심사" values={[]} onChange={(added) => update('interests', [...values.interests, ...added])} max={MAX_INTERESTS - values.interests.length} placeholder="목록에 없으면 직접 적어 주세요" />
            )}
          </>
        )
      }
      case 'majorOrGrade':
        return <TextField label={OPTIONAL_LABELS.majorOrGrade} hideLabel placeholder="예: 중학교 3학년, 컴퓨터공학" maxLength={30} value={values.majorOrGrade} onChange={(e) => update('majorOrGrade', e.target.value)} />
      case 'strengths':
        return <TagInput label="잘하는 것" values={values.strengths} onChange={(next) => update('strengths', next)} max={MAX_STRENGTHS} placeholder="예: 그림 그리기, 수학" />
      case 'values':
        return <ChipGroup label="가치관" options={VALUES} selected={values.values} onChange={(next) => update('values', next)} max={MAX_VALUES} />
      case 'roleModel':
        return <TextField label={OPTIONAL_LABELS.roleModel} hideLabel placeholder="예: 우리 엄마, 좋아하는 작가" maxLength={30} value={values.roleModel} onChange={(e) => update('roleModel', e.target.value)} />
      case 'mbti':
        return <SelectField label={OPTIONAL_LABELS.mbti} hideLabel options={MBTI_TYPES} placeholder="선택해 주세요" value={values.mbti} onChange={(e) => update('mbti', e.target.value)} />
    }
  }

  return (
    <form className="card stack" style={{ marginTop: 'var(--space-5)' }} aria-labelledby="form-title" onSubmit={onSubmit} noValidate>
      <h2 id="form-title" style={{ fontSize: 'var(--text-xl)' }}>
        새 인생 시작하기
      </h2>

      {serverError && (
        <p className="field-error" role="alert">
          {serverError}
        </p>
      )}

      <div className="grid-2">
        <TextField label="이름" required autoComplete="nickname" maxLength={NAME_MAX} help="게임 안에서 불릴 이름이에요. 닉네임도 괜찮아요." value={values.name} onChange={(e) => update('name', e.target.value)} onBlur={markBlurred('name')} error={visibleErrors.name} />
        <TextField label="나이" required type="number" inputMode="numeric" min={AGE_MIN} max={AGE_MAX} help="이 나이부터 인생이 시작돼요." value={values.age} onChange={(e) => update('age', e.target.value)} onBlur={markBlurred('age')} error={visibleErrors.age} />
      </div>

      <SelectField label="지금 상황" required options={SITUATIONS} placeholder="선택해 주세요" value={values.situation} onChange={(e) => update('situation', e.target.value)} onBlur={markBlurred('situation')} error={visibleErrors.situation} />

      <Segmented
        label="되고 싶은 직업이 있나요?"
        required
        options={[
          { value: 'yes', label: '있어요' },
          { value: 'no', label: '아직 없어요' },
        ]}
        value={values.hasDreamJob === null ? null : values.hasDreamJob ? 'yes' : 'no'}
        onChange={(value) => update('hasDreamJob', value === 'yes')}
      />
      {values.hasDreamJob && (
        <TextField label="어떤 직업인가요?" required placeholder="예: 과학자, 웹툰 작가, 요리사" maxLength={30} value={values.dreamJob} onChange={(e) => update('dreamJob', e.target.value)} onBlur={markBlurred('dreamJob')} error={visibleErrors.dreamJob} />
      )}

      <div className="divider-label">조금 더 알려 주세요 (선택)</div>
      <p className="small muted">건너뛰어도 괜찮아요. 나머지는 게임 속 사람들이 대화하면서 물어볼 거예요.</p>

      {shown.map((field) => {
        const isSkipped = skipped.includes(field)
        const headId = `optional-${field}`
        return (
          <section key={field} className={isSkipped ? 'optional-block optional-skipped' : 'optional-block'} aria-labelledby={headId}>
            <div className="optional-head">
              <span className="field-label" id={headId}>
                {OPTIONAL_LABELS[field]}
                {isSkipped ? <span className="muted small"> — 건너뛰었어요</span> : HINTS[field] && <span className="muted small"> ({HINTS[field]})</span>}
              </span>
              <Button variant="ghost" onClick={() => toggleSkip(field)}>
                {isSkipped ? '다시 고르기' : '건너뛰기'}
              </Button>
            </div>
            {!isSkipped && renderOptional(field)}
          </section>
        )
      })}

      <div className="start-submit">
        <Button type="submit" size="lg" block loading={submitting} disabled={!isValid} aria-describedby="start-help">
          인생 시작하기
        </Button>
        <p id="start-help" className="small muted">
          {isValid ? '준비됐어요!' : '필수 항목(*) 4개를 채우면 시작할 수 있어요.'}
        </p>
      </div>
    </form>
  )
}
