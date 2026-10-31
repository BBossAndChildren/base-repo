import { createContext, useContext } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastOptions {
  type?: ToastType
  message: string
  /** 자동으로 닫히는 시간. 0 이면 직접 닫을 때까지 남는다 */
  durationMs?: number
}

export interface ToastApi {
  show(options: ToastOptions): string
  dismiss(id: string): void
}

export const ToastContext = createContext<ToastApi | null>(null)

/** 진행을 막지 않는 짧은 안내 (05-ui-ux.md 6절). 브라우저 alert 대신 쓴다 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast 는 ToastProvider 안에서만 쓸 수 있습니다')
  return api
}
