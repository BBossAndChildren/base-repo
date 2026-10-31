import { readStorage, removeStorage, writeStorage } from '../lib/storage'

const PLAYER_ID_KEY = 'adult-prince.playerId'
let memoryPlayerId: string | null = null

/** 게스트 플레이어 ID (03 인증 방식). 모든 요청 헤더 X-Player-Id 로 보낸다 */
export function getPlayerId(): string | null {
  return memoryPlayerId ?? readStorage(PLAYER_ID_KEY)
}

export function setPlayerId(playerId: string): void {
  memoryPlayerId = playerId
  writeStorage(PLAYER_ID_KEY, playerId)
}

export function clearPlayerId(): void {
  memoryPlayerId = null
  removeStorage(PLAYER_ID_KEY)
}
