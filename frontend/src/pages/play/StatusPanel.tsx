import { cx } from '../../lib/cx'

/** 상태 패널에 보이는 값. funds · energy 는 백엔드가 state 에 담아 줄 때만 표시한다 (docs/game/03-rules.md) */
export interface StatusValues {
  age: number
  funds?: number
  energy?: number
}

export type StatusField = keyof StatusValues

/** 막대로 보여 줄 항목 (0~100 지수). 순서대로 표시한다 */
const METERS: { field: 'funds' | 'energy'; label: string }[] = [
  { field: 'funds', label: '자금' },
  { field: 'energy', label: '에너지' },
]

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function Placeholder({ rows }: { rows: number }) {
  return (
    <div className="placeholder-box" aria-label="게임 상태 자리 표시">
      <div className="placeholder-title">자금 · 에너지 (서버 연결 후 표시)</div>
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

function Meters({ values, changed, rows }: { values: StatusValues; changed: ReadonlySet<StatusField>; rows: number }) {
  const shown = METERS.filter((meter) => typeof values[meter.field] === 'number')
  if (shown.length === 0) return <Placeholder rows={rows} />
  return (
    <ul className="status-meters">
      {shown.map(({ field, label }) => {
        const value = clamp(values[field] as number)
        return (
          <li key={field} className={cx('status-meter', changed.has(field) && 'is-changed')}>
            <span className="status-meter-label">{label}</span>
            <span
              className="status-meter-track"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <span className={cx('status-meter-fill', `is-${field}`)} style={{ width: `${value}%` }} />
            </span>
            <span className="status-meter-value">{value}</span>
          </li>
        )
      })}
    </ul>
  )
}

interface StatusProps {
  values: StatusValues
  /** 방금 바뀐 항목. 잠깐 강조한다 */
  changed: ReadonlySet<StatusField>
}

/** 좁은 화면(1024px 미만)의 접이식 상태 막대. 시안처럼 게임 영역 위에 둔다 */
export function StatusBar({ values, changed }: StatusProps) {
  return (
    <details className="status-bar">
      <summary>
        <span className={cx('status-age-inline', changed.has('age') && 'is-changed')}>{values.age}세</span>
        <span className="small">
          상태 보기{' '}
          <span className="chev" aria-hidden="true">
            ▾
          </span>
        </span>
      </summary>
      <div className="status-bar-body">
        <Meters values={values} changed={changed} rows={2} />
      </div>
    </details>
  )
}

/** 넓은 화면의 상태 패널 (05 화면 2). 나이 + 자금 · 에너지(백엔드가 줄 때) */
export function StatusPanel({ values, changed }: StatusProps) {
  return (
    <aside className="status-panel" aria-label="내 상태">
      <div className="status-head">
        <div className="label">지금 나이</div>
        <div className={cx('status-age', changed.has('age') && 'is-changed')} aria-live="polite">
          {values.age}세
        </div>
      </div>
      <div className="status-body">
        <Meters values={values} changed={changed} rows={2} />
      </div>
    </aside>
  )
}
