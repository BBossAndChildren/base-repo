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
  | 'AI_UNAVAILABLE'
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

export interface ChatMessage {
  /** "narrator" · NPC 이름 · 사용자 */
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
}

// 1-5
export interface RecommendedJob {
  job: string
  isNew: boolean
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
  state: PlayState
  messages: ChatMessage[]
  ended: boolean
}
