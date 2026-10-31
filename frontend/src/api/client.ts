import { env } from '../lib/env'
import type { ApiFailure, ApiSuccess } from '../types/api'
import { ApiError, typeFromStatus } from './errors'
import { getPlayerId } from './player'

export const DEFAULT_TIMEOUT_MS = 15_000
/** 채팅 대기 30초 (03 기다리는 시간) */
export const CHAT_TIMEOUT_MS = 30_000

interface RequestOptions {
  body?: unknown
  timeoutMs?: number
  /** 게스트 발급처럼 X-Player-Id 가 없어도 되는 요청 */
  anonymous?: boolean
  fetchImpl?: typeof fetch
  baseUrl?: string
}

function isFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object' && value !== null && 'error' in value
}

function isSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return typeof value === 'object' && value !== null && 'data' in value
}

/** 공통 호출: {code, data} 를 풀고, 실패는 ApiError 로 던진다 (03 0절) */
export async function request<T>(method: 'GET' | 'POST', path: string, options: RequestOptions = {}): Promise<T> {
  return send<T>(method, path, options, true)
}

/** 3D 연동 API(1-4 · 1-8 · 1-9 · 1-10) — 응답을 {code, data} 로 감싸지 않는다 (03 공통 응답 형식 예외) */
export async function requestRaw<T>(method: 'GET' | 'POST', path: string, options: RequestOptions = {}): Promise<T> {
  return send<T>(method, path, options, false)
}

async function send<T>(method: 'GET' | 'POST', path: string, options: RequestOptions, enveloped: boolean): Promise<T> {
  const { body, timeoutMs = DEFAULT_TIMEOUT_MS, anonymous = false, fetchImpl = fetch, baseUrl = env.apiBaseUrl } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!anonymous) {
    const playerId = getPlayerId()
    if (!playerId) throw new ApiError(401, 'UNKNOWN_PLAYER')
    headers['X-Player-Id'] = playerId
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      // 쿠키를 쓰지 않는다 (06 CORS)
      credentials: 'omit',
    })
  } catch (cause) {
    if (controller.signal.aborted) throw new ApiError(504, 'TIMEOUT')
    throw new ApiError(0, 'NETWORK', undefined, { cause })
  } finally {
    clearTimeout(timer)
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || isFailure(payload)) {
    const status = response.ok && isFailure(payload) ? payload.code : response.status
    if (isFailure(payload)) throw new ApiError(status, payload.error.type, payload.error.message)
    throw new ApiError(status, typeFromStatus(status))
  }
  if (!enveloped) return payload as T
  if (!isSuccess<T>(payload)) throw new ApiError(response.status, 'UNKNOWN')
  return payload.data
}
