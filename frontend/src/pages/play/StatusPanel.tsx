import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { StatusField, StatusValues } from './statusModel'

const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`

const HOUSING_LABEL: Record<string, string> = {
  monthlyRent: '월세',
  jeonse: '전세',
  owned: '자가',
  family: '가족과 함께',
}

const DEVELOPMENT_LABEL: Record<string, string> = { grades: '성적', selfDevelopment: '자기계발' }

/** 0~100 막대 항목. 순서대로 표시한다 */
const METERS: { field: 'health' | 'energy' | 'stress'; label: string }[] = [
  { field: 'health', label: '건강' },
  { field: 'energy', label: '에너지' },
  { field: 'stress', label: '스트레스' },
]

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function Meter({ field, label, value, changed }: { field: string; label: string; value: number; changed: boolean }) {
  const shown = clamp(value)
  return (
    <li className={cx('status-meter', changed && 'is-changed')}>
      <span className="status-meter-label">{label}</span>
      <span className="status-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown}>
        <span className={cx('status-meter-fill', `is-${field}`)} style={{ width: `${shown}%` }} />
      </span>
      <span className="status-meter-value">{shown}</span>
    </li>
  )
}

function Placeholder() {
  return (
    <div className="placeholder-box" aria-label="게임 상태 자리 표시">
      <div className="placeholder-title">자금 · 건강 · 에너지 (서버 연결 후 표시)</div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true">
          <span className="skeleton-label" />
          <span className="skeleton" />
          <span>—</span>
        </div>
      ))}
    </div>
  )
}

function StatusDetails({ values, changed }: { values: StatusValues; changed: ReadonlySet<StatusField> }) {
  const meters = METERS.filter((meter) => values[meter.field] !== undefined)
  const showMoney = values.funds !== undefined || values.debt !== undefined
  const housing = values.housing && values.housing.type !== 'unknown' ? values.housing : undefined
  const development = values.development && values.development.value !== null ? values.development : undefined
  const people = values.people ?? []
  if (!showMoney && meters.length === 0 && !housing && !development && people.length === 0) return <Placeholder />
  return (
    <>
      {showMoney && (
        <dl className="status-money">
          <div className={cx('status-money-row', changed.has('funds') && 'is-changed')}>
            <dt>자금</dt>
            <dd>{won(values.funds ?? 0)}</dd>
          </div>
          <div className={cx('status-money-row', changed.has('debt') && 'is-changed')}>
            <dt>빚</dt>
            <dd>{won(values.debt ?? 0)}</dd>
          </div>
          {values.income !== undefined && values.income > 0 && (
            <div className="status-money-row">
              <dt>월 수입</dt>
              <dd>{won(values.income)}</dd>
            </div>
          )}
          {housing && (
            <div className={cx('status-money-row', changed.has('housing') && 'is-changed')}>
              <dt>주거</dt>
              <dd>
                {HOUSING_LABEL[housing.type] ?? housing.type} · 월 {won(housing.monthlyRent + housing.livingCost)}
              </dd>
            </div>
          )}
        </dl>
      )}
      {(meters.length > 0 || development) && (
        <ul className="status-meters">
          {meters.map(({ field, label }) => (
            <Meter key={field} field={field} label={label} value={values[field] as number} changed={changed.has(field)} />
          ))}
          {development && (
            <Meter
              field="development"
              label={DEVELOPMENT_LABEL[development.kind] ?? '성장'}
              value={development.value as number}
              changed={changed.has('development')}
            />
          )}
        </ul>
      )}
      {people.length > 0 && (
        <section className={cx('status-people', changed.has('people') && 'is-changed')} aria-label="주변 인물">
          <h3 className="status-subtitle">주변 인물</h3>
          <ul className="status-meters">
            {people.map((person) => (
              <Meter key={person.id} field="relationship" label={person.name} value={person.value} changed={false} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

interface StatusProps {
  values: StatusValues
  /** 방금 바뀐 항목. 잠깐 강조한다 */
  changed: ReadonlySet<StatusField>
  /** 상태 아래에 둘 조작 (일시정지 버튼, 05 화면 2) */
  actions?: ReactNode
}

interface StatusBarProps extends StatusProps {
  /** 좁은 화면에서 상태 아래에 함께 펼칠 내용 (3D 체험 카드) */
  extra?: ReactNode
}

/** 좁은 화면(1024px 미만)의 접이식 상태 막대. 게임 영역 위에 둔다 */
export function StatusBar({ values, changed, actions, extra }: StatusBarProps) {
  return (
    <details className="status-bar">
      <summary>
        <span className={cx('status-age-inline', changed.has('age') && 'is-changed')}>{values.age}세</span>
        <span className="small">
          {values.funds !== undefined && <span className="status-bar-funds">{won(values.funds)} · </span>}
          상태 보기{' '}
          <span className="chev" aria-hidden="true">
            ▾
          </span>
        </span>
      </summary>
      <div className="status-bar-body">
        <StatusDetails values={values} changed={changed} />
        {actions && <div className="status-actions">{actions}</div>}
        {extra}
      </div>
    </details>
  )
}

/** 넓은 화면의 상태 패널 (05 화면 2). 나이 + 자금 · 빚 · 주거 + 건강 · 에너지 · 스트레스 · 성적/자기계발 */
export function StatusPanel({ values, changed, actions }: StatusProps) {
  return (
    <aside className="status-panel" aria-label="내 상태">
      <div className="status-head">
        <div className="label">지금 나이</div>
        <div className={cx('status-age', changed.has('age') && 'is-changed')} aria-live="polite">
          {values.age}세
        </div>
      </div>
      <div className="status-body">
        <StatusDetails values={values} changed={changed} />
        {actions && <div className="status-actions">{actions}</div>}
      </div>
    </aside>
  )
}
