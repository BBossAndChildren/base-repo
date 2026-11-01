import { useId, type FormEvent } from 'react'
import { Button } from '../../components'
import type { PendingChoice } from '../../types/api'
import { describeChoice } from './pendingChoices'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  hints: string[]
  /** 서버 힌트가 없을 때만 보여 주는 현재 화면의 입력 예시 */
  inputExamples?: string[]
  /** 백엔드가 기다리는 선택 (05 9절). 보기를 누르면 입력칸에 채운다 */
  choices?: PendingChoice[]
  disabled: boolean
  waiting: boolean
}

export const MESSAGE_MAX = 300

/** 입력 · 힌트 (05 화면 2) */
export function Composer({ value, onChange, onSubmit, hints, inputExamples = [], choices = [], disabled, waiting }: ComposerProps) {
  const inputId = useId()
  const canSend = !disabled && value.trim().length > 0
  const shownHints = hints.length > 0 ? hints : choices.length === 0 ? inputExamples : []

  function submit(event: FormEvent) {
    event.preventDefault()
    if (canSend) onSubmit()
  }

  return (
    <div className="chat-footer">
      {choices.length > 0 && !disabled && (
        <div className="choices" role="group" aria-label="선택이 필요해요">
          {choices.map((choice, index) => (
            <div key={`${choice.kind}-${index}`} className="choice">
              <p className="choice-text">{describeChoice(choice)}</p>
              <div className="choice-options">
                {choice.options.map((option) => (
                  <button key={option} type="button" className="chip chip-hint" onClick={() => onChange(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {shownHints.length > 0 && !disabled && (
        <div className="hints" role="group" aria-label="이렇게 말해 볼 수 있어요">
          <span className="hints-label">{hints.length > 0 ? '힌트' : '입력 예시'}</span>
          {shownHints.map((hint) => (
            <button key={hint} type="button" className="chip chip-hint" onClick={() => onChange(hint)}>
              {hint}
            </button>
          ))}
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>
          하고 싶은 말이나 행동
        </label>
        <input
          id={inputId}
          className="input"
          placeholder="하고 싶은 말이나 행동을 자유롭게 적어 보세요"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={MESSAGE_MAX}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // 한글 조합 중 Enter 는 보내지 않는다 (05 8절 · 07 B09)
            if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
          }}
        />
        <Button type="submit" disabled={!canSend}>
          보내기
        </Button>
      </form>
      <p className="composer-status" aria-live="polite">
        {waiting ? '응답을 기다리고 있어요' : 'Enter 로 보내기'}
      </p>
    </div>
  )
}
