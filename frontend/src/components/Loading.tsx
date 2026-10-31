interface SpinnerProps {
  size?: 'sm' | 'md'
  /** 버튼 안처럼 옆에 글자가 있으면 스크린 리더에 읽히지 않게 한다 */
  decorative?: boolean
  label?: string
}

export function Spinner({ size = 'md', decorative, label = '불러오는 중' }: SpinnerProps) {
  const style = size === 'sm' ? { width: 16, height: 16, borderWidth: 2 } : undefined
  if (decorative) return <span className="spinner" style={style} aria-hidden="true" />
  return <span className="spinner" style={style} role="status" aria-label={label} />
}

/** AI 응답 대기 표시 ("생각하는 중…") */
export function TypingIndicator({ label = '생각하는 중…' }: { label?: string }) {
  return (
    <span role="status" className="row" style={{ gap: 8 }}>
      <span className="typing" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="muted small">{label}</span>
    </span>
  )
}
