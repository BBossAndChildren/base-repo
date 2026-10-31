import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

interface FieldShellProps {
  id: string
  label: string
  required?: boolean
  help?: string
  error?: string
  children: ReactNode
}

function FieldShell({ id, label, required, help, error, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
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
  help?: string
  error?: string
}

export function TextField({ label, help, error, required, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={error}>
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
  options: readonly string[]
  placeholder?: string
  help?: string
  error?: string
}

export function SelectField({ label, options, placeholder, help, error, required, ...rest }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={error}>
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
