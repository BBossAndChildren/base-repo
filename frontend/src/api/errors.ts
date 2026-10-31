import type { ApiErrorType } from '../types/api'

/** 화면 문구 (05-ui-ux.md 5절). 서버가 message 를 주면 그것을 우선한다 */
export const DEFAULT_ERROR_MESSAGES: Record<ApiErrorType, string> = {
  INVALID_INPUT: '입력 내용을 다시 확인해 주세요.',
  UNKNOWN_PLAYER: '플레이 정보를 찾을 수 없어요. 처음부터 다시 시작해 주세요.',
  NOT_FOUND: '요청한 정보를 찾을 수 없어요.',
  ALREADY_ENDED: '이미 끝난 진행이에요.',
  NOT_ENDED: '아직 이야기가 끝나지 않았어요.',
  AI_UNAVAILABLE: '잠시 후 다시 시도해 주세요.',
  TIMEOUT: '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.',
  NETWORK: '연결이 끊겼어요. 인터넷 연결을 확인해 주세요.',
  UNKNOWN: '문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
}

const KNOWN_TYPES = new Set<string>(Object.keys(DEFAULT_ERROR_MESSAGES))

export class ApiError extends Error {
  readonly status: number
  readonly type: ApiErrorType

  constructor(status: number, type: string, message?: string, options?: { cause?: unknown }) {
    const knownType = (KNOWN_TYPES.has(type) ? type : 'UNKNOWN') as ApiErrorType
    super(message || DEFAULT_ERROR_MESSAGES[knownType], options)
    this.name = 'ApiError'
    this.status = status
    this.type = knownType
  }
}

/** HTTP 상태만 있고 error.type 이 없을 때의 대응 */
export function typeFromStatus(status: number): ApiErrorType {
  if (status === 400) return 'INVALID_INPUT'
  if (status === 401) return 'UNKNOWN_PLAYER'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'ALREADY_ENDED'
  if (status === 502) return 'AI_UNAVAILABLE'
  if (status === 504) return 'TIMEOUT'
  return 'UNKNOWN'
}
