// 백엔드 API 타입 — 기준: docs/development/03-api.md 1부. API 문서가 바뀌면 이 파일도 같은 PR 에서 고친다.

/** 성공 응답 (03 0절 공통 응답 형식) */
export interface ApiSuccess<T> {
  code: number
  data: T
}

/** 실패 응답 */
export interface ApiFailure {
  code: number
  error: { type: string; message: string }
}

/** 03 결과 코드 목록의 error.type + 프론트가 만드는 네트워크 오류 */
export type ApiErrorType =
  | 'INVALID_INPUT'
  | 'UNKNOWN_PLAYER'
  | 'NOT_FOUND'
  | 'ALREADY_ENDED'
  | 'NOT_ENDED'
  | 'REQUEST_CONFLICT'
  | 'STATE_CONFLICT'
  | 'PLAY_PAUSED'
  | 'TURN_IN_PROGRESS'
  | 'AI_UNAVAILABLE'
  | 'CONTENT_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNKNOWN'

/**
 * 게임 상태. 키 이름은 작가 초안(docs/game/03-rules.md) 기준이며 아직 백엔드 · AI 와 합의 전이다.
 * 화면에는 우선 age 만 표시한다 (05-ui-ux.md 화면 2).
 */
export interface PlayState {
  age: number
  elapsedDays?: number
  funds?: number
  energy?: number
  ability?: number
  relationship?: Record<string, number>
  interests?: Record<string, number>
  [key: string]: unknown
}

/** 메시지 형식 (03 메시지 형식) */
export type MessageRole = 'user' | 'npc' | 'narrator'

export interface ChatMessage {
  role: MessageRole
  /** 화면에 보일 이름 (NPC 이름 · 플레이어 이름 · "나레이션") */
  speaker: string
  text: string
}

export interface StateChange {
  field: string
  from?: unknown
  to: unknown
}

/** 3D 체험 분기 (03 1-3) */
export interface ExperienceOffer {
  buildId: string
  buildUrl: string
  roomId: string
  scenarioId: string
  scenarioVersion: string
  /** 체험 제목 (Unity 허용 목록의 title) */
  title: string
  /** 관련 직업 */
  jobs: string[]
  /** 지금 분기인 이유 (AI branch.reason) */
  reason: string
}

export interface Notice {
  type: string
  message: string
}

// 1-1
export interface CreatePlayerResponse {
  playerId: string
}

// 1-2
export interface StartPlayRequest {
  name: string
  age: number
  situation: string
  hasDreamJob: boolean
  dreamJob?: string
  gender?: string
  interests?: string[]
  majorOrGrade?: string
  strengths?: string[]
  values?: string[]
  roleModel?: string
  mbti?: string
}

export interface StartPlayResponse {
  playId: string
  sessionId: string
  state: PlayState
  messages: ChatMessage[]
}

// 1-3
export interface TurnRequest {
  /** 같은 행동을 다시 보낼 때는 유지하고, 새 행동에는 새 UUID (03 게임 상태와 턴 확장) */
  requestId: string
  message: string
}

export interface TurnResponse {
  turnId: string
  messages: ChatMessage[]
  stateChanges: StateChange[]
  hints: string[]
  experience: ExperienceOffer | null
  notice?: Notice
  ended: boolean
  /** 이번 턴 저장 후 백엔드가 확정한 전체 상태 (있으면 이 값을 화면에 쓴다) */
  state?: PlayState
  stateVersion?: number
  /** 자금 부족 · 입원 · 중요 결정에서 기다리는 선택 */
  pendingChoices?: unknown[]
  /** 이번 턴의 공개 사건 */
  events?: unknown[]
}

// 1-5
/** 추천 근거 종류 (03 1-5) */
export type RecommendationBasis = 'experience' | 'conversation' | 'interest' | 'dreamJob'

export interface RecommendedJob {
  job: string
  isNew: boolean
  basis: RecommendationBasis[]
  reason: string
  work: string
  nextSteps: string[]
}

export interface PlayResult {
  ending: string
  recommendedJobs: RecommendedJob[]
}

// 1-6
export interface PlaySummary {
  playId: string
  startedAt: string
  ended: boolean
  summary: string
}

export interface MyPlaysResponse {
  plays: PlaySummary[]
}

// 1-7
export interface PlayResume {
  playId: string
  sessionId: string
  state: PlayState
  messages: ChatMessage[]
  ended: boolean
  /** 명시적 일시정지 여부 (03 게임 상태와 턴 확장) */
  paused?: boolean
  stateVersion?: number
  activePlaySeconds?: number
  scene?: unknown
  pendingChoices?: unknown[]
  lastTurnId?: string | null
}
