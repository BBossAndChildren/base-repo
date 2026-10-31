import { cx } from '../../lib/cx'

function Placeholder({ rows }: { rows: number }) {
  return (
    <div className="placeholder-box" aria-label="게임 상태 자리 표시">
      <div className="placeholder-title">게임 상태 (작가 확정 후 표시)</div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true">
          <span className="skeleton-label" />
          <span className="skeleton" />
          <span>—</span>
        </div>
      ))}
    </div>
  )
}

interface StatusProps {
  age: number
  /** 방금 바뀌었으면 잠깐 강조 */
  ageChanged: boolean
}

/** 좁은 화면(1024px 미만)의 접이식 상태 막대. 시안처럼 게임 영역 위에 둔다 */
export function StatusBar({ age, ageChanged }: StatusProps) {
  return (
    <details className="status-bar">
      <summary>
        <span className={cx('status-age-inline', ageChanged && 'is-changed')}>{age}세</span>
        <span className="small">
          상태 보기{' '}
          <span className="chev" aria-hidden="true">
            ▾
          </span>
        </span>
      </summary>
      <div className="status-bar-body">
        <Placeholder rows={3} />
      </div>
    </details>
  )
}

/**
 * 넓은 화면의 상태 패널 (05 화면 2). 지금은 나이만 표시한다 — 다른 항목은 docs/game/03-rules.md 의 키를
 * 백엔드 · AI 와 합의한 뒤 추가한다
 */
export function StatusPanel({ age, ageChanged }: StatusProps) {
  return (
    <aside className="status-panel" aria-label="내 상태">
      <div className="status-head">
        <div className="label">지금 나이</div>
        <div className={cx('status-age', ageChanged && 'is-changed')} aria-live="polite">
          {age}세
        </div>
      </div>
      <div className="status-body">
        <Placeholder rows={5} />
      </div>
    </aside>
  )
}
