import { CHAT_TIMEOUT_MS, request } from './client'
import type { GameApi } from './gameApi'

const id = (value: string) => encodeURIComponent(value)

export const httpGameApi: GameApi = {
  createPlayer: () => request('POST', '/api/v1/players', { anonymous: true }),
  startPlay: (body) => request('POST', '/api/v1/plays', { body, timeoutMs: CHAT_TIMEOUT_MS }),
  getPlay: (playId) => request('GET', `/api/v1/plays/${id(playId)}`),
  setPaused: (playId, paused) => request('PATCH', `/api/v1/plays/${id(playId)}`, { body: { paused } }),
  sendTurn: (playId, body) => request('POST', `/api/v1/plays/${id(playId)}/turns`, { body, timeoutMs: CHAT_TIMEOUT_MS }),
  getResult: (playId) => request('GET', `/api/v1/plays/${id(playId)}/result`, { timeoutMs: CHAT_TIMEOUT_MS }),
  listMyPlays: () => request('GET', '/api/v1/players/me/plays'),
}
