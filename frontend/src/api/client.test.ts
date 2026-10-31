import { beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './client'
import { ApiError } from './errors'
import { clearPlayerId, setPlayerId } from './player'

const BASE = 'https://api.example.test'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('request', () => {
  beforeEach(() => {
    clearPlayerId()
  })

  it('성공 응답 {code, data} 에서 data 만 돌려준다', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { code: 200, data: { ok: true } }))
    await expect(request('GET', '/api/v1/x', { fetchImpl, baseUrl: BASE })).resolves.toEqual({ ok: true })
  })

  it('X-Player-Id 헤더를 붙이고 쿠키를 보내지 않는다', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { code: 200, data: {} }))
    await request('POST', '/api/v1/x', { body: { a: 1 }, fetchImpl, baseUrl: BASE })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${BASE}/api/v1/x`)
    expect(init.headers['X-Player-Id']).toBe('p-1')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.credentials).toBe('omit')
    expect(init.body).toBe('{"a":1}')
  })

  it('게스트 ID 가 없으면 요청하지 않고 UNKNOWN_PLAYER', async () => {
    const fetchImpl = vi.fn()
    await expect(request('GET', '/api/v1/x', { fetchImpl, baseUrl: BASE })).rejects.toMatchObject({ type: 'UNKNOWN_PLAYER' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('anonymous 요청은 게스트 ID 없이 보낸다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { code: 200, data: { playerId: 'new' } }))
    await expect(request('POST', '/api/v1/players', { anonymous: true, fetchImpl, baseUrl: BASE })).resolves.toEqual({ playerId: 'new' })
    expect(fetchImpl.mock.calls[0][1].headers['X-Player-Id']).toBeUndefined()
  })

  it('실패 응답의 error.type · message 를 그대로 쓴다', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(409, { code: 409, error: { type: 'ALREADY_ENDED', message: '이미 끝났어요' } }))
    const error = await request('GET', '/x', { fetchImpl, baseUrl: BASE }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, type: 'ALREADY_ENDED', message: '이미 끝났어요' })
  })

  it('본문 없는 HTTP 오류는 상태 코드로 종류를 정하고 기본 문구를 쓴다', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }))
    await expect(request('GET', '/x', { fetchImpl, baseUrl: BASE })).rejects.toMatchObject({
      type: 'AI_UNAVAILABLE',
      message: '잠시 후 다시 시도해 주세요.',
    })
  })

  it('모르는 error.type 은 UNKNOWN 으로 바꾼다', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { code: 500, error: { type: 'WEIRD', message: '' } }))
    await expect(request('GET', '/x', { fetchImpl, baseUrl: BASE })).rejects.toMatchObject({ type: 'UNKNOWN' })
  })

  it('네트워크 실패는 NETWORK', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('GET', '/x', { fetchImpl, baseUrl: BASE })).rejects.toMatchObject({ type: 'NETWORK', status: 0 })
  })

  it('시간 초과면 요청을 끊고 TIMEOUT', async () => {
    setPlayerId('p-1')
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    )
    await expect(request('GET', '/x', { fetchImpl, baseUrl: BASE, timeoutMs: 20 })).rejects.toMatchObject({ type: 'TIMEOUT' })
  })
})
