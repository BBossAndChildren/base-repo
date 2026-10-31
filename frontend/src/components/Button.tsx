import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../lib/cx'
import { Spinner } from './Loading'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger-text',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  /** 처리 중이면 누를 수 없고 스피너를 보여 준다 */
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, loading, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', VARIANT_CLASS[variant], size !== 'md' && `btn-${size}`, block && 'btn-block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="sm" decorative />}
      {children}
    </button>
  )
}
