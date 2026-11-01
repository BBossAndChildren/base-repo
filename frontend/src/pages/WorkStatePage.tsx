import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError, gameApi } from '../api'
import { Button, ErrorScreen, Spinner } from '../components'
import { getLastPlayId } from '../lib/lastPlay'
import '../styles/work.css'
import type { PlayResume } from '../types/api'

const won = (value: unknown) => (typeof value === 'number' ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—')
const text = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value))
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {})
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.map(record) : [])

const INTEREST_LEVEL = ['', '아주 낮음', '낮음', '보통', '높음', '아주 높음']

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="work-table">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card work-section" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/** 백엔드가 확정한 상태 중 일반 상태 패널에 보이지 않는 값을 펼쳐 본다 (03 게임 상태와 턴 확장) */
export function HiddenState({ play }: { play: PlayResume }) {
  const state = play.state
  const names = new Map((play.npcs ?? []).map((npc) => [npc.id, npc.name]))
  const relationship = Object.entries(record(state.relationship))
  const interests = Object.entries(record(state.interests))
  const occupation = record(state.occupation)
  const salarySource = record(occupation.salarySource)
  const housing = record(state.housing)
  const support = record(state.support)
  const development = record(state.development)
  const debts = list(state.debts)
  const arrears = list(state.arrears)
  const experiences = list(state.experiences)
  return (
    <>
      <Section title="기본">
        <Table
          rows={[
            ['나이 · 게임 날짜', `${text(state.age)}세 · ${text(state.gameDate)}`],
            ['지낸 날', `${text(state.elapsedDays)}일`],
            ['건강 · 에너지 · 스트레스', `${text(state.health)} · ${text(state.energy)} · ${text(state.stress)}`],
            ['상태 버전 · 활성 시간', `${text(play.stateVersion)} · ${Math.round(play.activePlaySeconds ?? 0)}초`],
            ['일시정지 · 종료', `${play.paused ? '예' : '아니오'} · ${play.ended ? '예' : '아니오'}`],
          ]}
        />
      </Section>
      <Section title="주변 인물 관계 (0~100)">
        {relationship.length === 0 ? (
          <p className="muted small">아직 관계 기록이 없어요.</p>
        ) : (
          <Table rows={relationship.map(([id, value]) => [`${names.get(id) ?? id} (${id})`, text(value)])} />
        )}
        {(play.npcs ?? []).length > 0 && <p className="muted small">만난 인물: {(play.npcs ?? []).map((npc) => npc.name).join(', ')}</p>}
      </Section>
      <Section title="흥미 (1~5, 미확인은 —)">
        {interests.length === 0 ? (
          <p className="muted small">기록된 관심 분야가 없어요.</p>
        ) : (
          <Table rows={interests.map(([field, level]) => [field, typeof level === 'number' ? `${level} · ${INTEREST_LEVEL[level] ?? ''}` : '미확인'])} />
        )}
      </Section>
      <Section title="돈">
        <Table
          rows={[
            ['자금 · 빚', `${won(state.funds)} · ${won(state.debt)}`],
            ['가족 지원 (월)', won(support.monthlyAmount)],
            ['주거', `${text(housing.type)} · 보증금 ${won(housing.deposit)}${housing.depositPaid ? ' (냄)' : ''} · 월세 ${won(housing.monthlyRent)} · 생활비 ${won(housing.livingCost)}`],
          ]}
        />
        <h3>빚</h3>
        {debts.length === 0 ? <p className="muted small">없음</p> : <Table rows={debts.map((row) => [text(row.creditor), `${won(row.balance)} (${text(row.id)})`])} />}
        <h3>미납</h3>
        {arrears.length === 0 ? <p className="muted small">없음</p> : <Table rows={arrears.map((row) => [`${text(row.creditor)} · ${text(row.gameDate)}`, won(row.amount)])} />}
      </Section>
      <Section title="직업 · 성장">
        <Table
          rows={[
            ['상태 · 직업', `${text(occupation.status)} · ${text(occupation.currentJob)}`],
            ['준비 중', text(occupation.preparation)],
            ['월급', won(occupation.monthlySalary)],
            ['월급 근거', salarySource.url ? `${text(salarySource.fact)} (${text(salarySource.url)}, ${text(salarySource.checkedAt)})` : '—'],
            ['성장', `${text(development.kind)} · ${text(development.value)} (이전 성적 ${text(development.previousGrades)})`],
          ]}
        />
      </Section>
      <Section title="3D 체험 기록">
        {experiences.length === 0 ? (
          <p className="muted small">없음</p>
        ) : (
          <Table rows={experiences.map((row) => [text(row.scenarioId), text(record(row.result).outcome)])} />
        )}
      </Section>
      <Section title="대기 중인 선택">
        {(play.pendingChoices ?? []).length === 0 ? <p className="muted small">없음</p> : <pre className="work-json">{JSON.stringify(play.pendingChoices, null, 2)}</pre>}
      </Section>
      <details className="card work-section">
        <summary>원본 state JSON</summary>
        <pre className="work-json">{JSON.stringify(state, null, 2)}</pre>
      </details>
      <p className="muted small">
        건강 0 · 고스트레스 지속 기간, 원장(ledger), 정산한 달, NPC 기억은 서버 DB(plays.progress · game_* 테이블)에만 있어요.
      </p>
    </>
  )
}

/** /work/state — 내부 테스트용: 이 브라우저의 마지막 플레이(또는 ?play=) 숨겨진 상태 보기 */
export function WorkStatePage() {
  const playId = new URLSearchParams(window.location.search).get('play') ?? getLastPlayId()
  const [play, setPlay] = useState<PlayResume | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!playId) return
    let cancelled = false
    gameApi.getPlay(playId).then(
      (resumed) => {
        if (!cancelled) setPlay(resumed)
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : '상태를 불러오지 못했어요.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [playId, reload])

  if (!playId) return <ErrorScreen title="플레이가 없어요" message="이 브라우저에서 게임을 시작한 뒤 다시 열어 주세요. (?play=<playId> 로도 볼 수 있어요)" />
  if (error) return <ErrorScreen title="숨겨진 상태 보기" message={error} />
  if (!play)
    return (
      <div className="page-narrow work">
        <Spinner label="상태를 불러오는 중" />
      </div>
    )
  return (
    <div className="page-narrow work">
      <p className="work-kicker">내부 테스트용 · 내 플레이만 볼 수 있어요</p>
      <h1>숨겨진 상태</h1>
      <div className="row work-actions">
        <span className="muted small">
          <code>{play.playId}</code>
        </span>
        <Button size="sm" variant="ghost" onClick={() => setReload((value) => value + 1)}>
          새로 고침
        </Button>
        <Link className="btn btn-ghost btn-sm" to={`/play/${play.playId}`}>
          게임으로
        </Link>
      </div>
      <HiddenState play={play} />
    </div>
  )
}
