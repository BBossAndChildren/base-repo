import { env } from '../lib/env'
import { mockExperienceApi } from '../mocks/mockExperienceApi'
import { mockGameApi } from '../mocks/mockGameApi'
import { httpExperienceApi, type ExperienceApi } from './experienceApi'
import type { GameApi } from './gameApi'
import { httpGameApi } from './httpGameApi'
import { getPlayerId, setPlayerId } from './player'

/** 화면에서는 이 객체만 쓴다. VITE_USE_MOCK 으로 mock / 실제 서버를 고른다 */
export const gameApi: GameApi = env.useMock ? mockGameApi : httpGameApi
export const experienceApi: ExperienceApi = env.useMock ? mockExperienceApi : httpExperienceApi

/** 게스트 ID 가 없으면 발급받아 보관한다 (FE1) */
export async function ensurePlayerId(api: GameApi = gameApi): Promise<string> {
  const existing = getPlayerId()
  if (existing) return existing
  const { playerId } = await api.createPlayer()
  setPlayerId(playerId)
  return playerId
}

export { ApiError } from './errors'
export type { ExperienceApi } from './experienceApi'
export type { GameApi } from './gameApi'
