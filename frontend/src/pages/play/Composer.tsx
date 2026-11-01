import { useId, type FormEvent } from 'react'
import { Button } from '../../components'
import type { PendingChoice } from '../../types/api'
import { describeChoice } from './pendingChoices'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  hints: string[]
  /** 대기 선택이 없을 때 서버 힌트와 별도로 보여 주는 입력 예시 */
  inputExamples?: string[]
  /** 백엔드가 기다리는 선택 (05 9절). 보기를 누르면 입력칸에 채운다 */
  choices?: PendingChoice[]
  disabled: boolean
  waiting: boolean
}

export const MESSAGE_MAX = 300

const INPUT_EXAMPLES = ['하루 공부할게', '하루 쉴게']

/** 입력 · 힌트 (05 화면 2) */
export function Composer({ value, onChange, onSubmit, hints, inputExamples = INPUT_EXAMPLES, choices = [], disabled, waiting }: ComposerProps) {
  const inputId = useId()
  const canSend = !disabled && value.trim().length > 0
  const shownExamples = [...new Set(inputExamples.map((text) => text.trim()).filter(Boolean))]
  const shownHints = [...new Set(hints.map((text) => text.trim()).filter(Boolean))].filter((hint) => !shownExamples.includes(hint))
  const helpId = `${inputId}-help`

  function submit(event: FormEvent) {
    event.preventDefault()
    if (canSend) onSubmit()
  }

  return (
    <div className="chat-footer">
      <p id={helpId} className="small muted">
        이야기를 읽고 하고 싶은 말이나 행동을 적어 보세요. 보기를 누른 뒤 고쳐 보내도 괜찮아요.
      </p>
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
      {choices.length === 0 && shownHints.length > 0 && !disabled && (
        <div className="hints" role="group" aria-label="이렇게 말해 볼 수 있어요">
          <span className="hints-label">힌트</span>
          {shownHints.map((hint) => (
            <button key={hint} type="button" className="chip chip-hint" onClick={() => onChange(hint)}>
              {hint}
            </button>
          ))}
        </div>
      )}
      {choices.length === 0 && shownExamples.length > 0 && !disabled && (
        <div className="hints" role="group" aria-label="입력 예시">
          <span className="hints-label">입력 예시</span>
          {shownExamples.map((example) => (
            <button key={example} type="button" className="chip chip-hint" onClick={() => onChange(example)}>
              {example}
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
          aria-describedby={helpId}
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
