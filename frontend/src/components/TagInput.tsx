import { useId, useState } from 'react'
import { Button } from './Button'

interface TagInputProps {
  label: string
  values: readonly string[]
  onChange: (values: string[]) => void
  max: number
  placeholder?: string
  maxLength?: number
}

/** 직접 입력해서 여러 개를 쌓는 입력 (잘하는 것 · 관심사 직접 입력) */
export function TagInput({ label, values, onChange, max, placeholder, maxLength = 20 }: TagInputProps) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const reachedMax = values.length >= max

  function add() {
    const value = draft.trim()
    if (!value || reachedMax || values.includes(value)) return
    onChange([...values, value])
    setDraft('')
  }

  return (
    <div>
      {values.length > 0 && (
        <ul className="chips" aria-label={`${label} 목록`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {values.map((value) => (
            <li key={value}>
              <button type="button" className="chip" aria-pressed="true" onClick={() => onChange(values.filter((item) => item !== value))}>
                {value}
                <span className="sr-only"> 지우기</span> ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="tag-input">
        <label className="sr-only" htmlFor={id}>
          {label} 직접 입력
        </label>
        <input
          id={id}
          className="input"
          value={draft}
          maxLength={maxLength}
          placeholder={reachedMax ? `최대 ${max}개까지 적을 수 있어요` : placeholder}
          disabled={reachedMax}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // 한글 조합 중 Enter 는 무시한다 (05 8절)
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button variant="secondary" size="sm" onClick={add} disabled={reachedMax || !draft.trim()}>
          추가
        </Button>
      </div>
    </div>
  )
}
