import { useId } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T | null
  onChange: (value: T) => void
  required?: boolean
}

/** 예 / 아니오 같은 단일 선택 (라디오) */
export function Segmented<T extends string>({ label, options, value, onChange, required }: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, marginInline: 0, minWidth: 0 }}>
      <legend className="field-label">
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="segmented">
        {options.map((option) => {
          const id = `${name}-${option.value}`
          return (
            <span key={option.value}>
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                required={required}
              />
              <label htmlFor={id}>{option.label}</label>
            </span>
          )
        })}
      </div>
    </fieldset>
  )
}
