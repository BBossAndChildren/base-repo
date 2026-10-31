import { Badge } from '../../components'
import type { RecommendationBasis, RecommendedJob } from '../../types/api'

const BASIS_LABEL: Record<RecommendationBasis, string> = {
  experience: '3D 체험함',
  conversation: '대화에서 관심',
  interest: '흥미 기록',
  dreamJob: '희망 직업',
}

/** 추천 직업 카드 (05 화면 4) */
export function JobCard({ job, index }: { job: RecommendedJob; index: number }) {
  const titleId = `job-${index}`
  return (
    <article className={job.isNew ? 'card job-card is-new' : 'card job-card'} aria-labelledby={titleId}>
      <div className="job-card-head">
        <div>
          <span className="job-kicker">{job.isNew ? '다음에 경험해 볼 일' : '관심을 보인 일'}</span>
          <h3 id={titleId}>{job.job}</h3>
        </div>
        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
          {job.isNew && <Badge tone="new">새로운 일</Badge>}
          {job.basis.map((basis) => (
            <Badge key={basis} tone={basis === 'experience' ? 'success' : 'muted'}>
              {BASIS_LABEL[basis]}
            </Badge>
          ))}
        </div>
      </div>
      <div className="job-section">
        <h4>추천 이유</h4>
        <p>{job.reason}</p>
      </div>
      <div className="job-section">
        <h4>하는 일</h4>
        <p>{job.work}</p>
      </div>
      {job.nextSteps.length > 0 && (
        <div className="job-section">
          <h4>다음 준비 방향</h4>
          <ol>
            {job.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
