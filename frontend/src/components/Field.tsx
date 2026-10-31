import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

interface FieldShellProps {
  id: string
  label: string
  /** 라벨을 화면에서 숨기고 스크린 리더에만 읽힌다 (바깥에 같은 제목이 있을 때) */
  hideLabel?: boolean
  required?: boolean
  help?: string
  error?: string
  children: ReactNode
}

function FieldShell({ id, label, hideLabel, required, help, error, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {help && !error && (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function describedBy(id: string, help?: string, error?: string) {
  if (error) return `${id}-error`
  if (help) return `${id}-help`
  return undefined
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hideLabel?: boolean
  help?: string
  error?: string
}

export function TextField({ label, hideLabel, help, error, required, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} required={required} help={help} error={error}>
      <input
        id={id}
        className={className ? `input ${className}` : 'input'}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      />
    </FieldShell>
  )
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  hideLabel?: boolean
  options: readonly string[]
  placeholder?: string
  help?: string
  error?: string
}

export function SelectField({ label, hideLabel, options, placeholder, help, error, required, ...rest }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} required={required} help={help} error={error}>
      <select
        id={id}
        className="select"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
