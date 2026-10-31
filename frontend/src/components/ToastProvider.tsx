import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { ToastContext, type ToastApi, type ToastOptions, type ToastType } from './toast'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

const ICON: Record<ToastType, string> = { info: 'i', success: '✓', error: '!' }
export const DEFAULT_TOAST_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const show = useCallback(
    ({ type = 'info', message, durationMs = DEFAULT_TOAST_MS }: ToastOptions) => {
      const id = crypto.randomUUID()
      setToasts((items) => [...items, { id, type, message }])
      if (durationMs > 0) timers.current.set(id, setTimeout(() => dismiss(id), durationMs))
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={cx('toast', toast.type !== 'info' && `toast-${toast.type}`)} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon" aria-hidden="true">
              {ICON[toast.type]}
            </span>
            <p className="toast-body" style={{ margin: 0 }}>
              {toast.message}
            </p>
            <button type="button" className="toast-close" aria-label="알림 닫기" onClick={() => dismiss(toast.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
