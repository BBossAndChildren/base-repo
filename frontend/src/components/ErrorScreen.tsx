import { Button } from './Button'

interface ErrorScreenProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

/** 화면 전체를 대신하는 오류 (05-ui-ux.md 6절: 무엇이 안 됐는지 + 할 수 있는 일) */
export function ErrorScreen({ title = '문제가 생겼어요', message, onRetry, retryLabel = '다시 시도' }: ErrorScreenProps) {
  return (
    <section className="error-screen" role="alert">
      <div className="error-art" aria-hidden="true">
        🌙
      </div>
      <h2>{title}</h2>
      <p className="muted">{message}</p>
      {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
    </section>
  )
}
