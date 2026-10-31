import { readStorage, removeStorage, writeStorage } from './storage'

const LAST_PLAY_KEY = 'adult-prince.lastPlayId'

/** 이어하기용: 마지막으로 시작 · 진행한 플레이 (FE8) */
export function getLastPlayId(): string | null {
  return readStorage(LAST_PLAY_KEY)
}

export function setLastPlayId(playId: string): void {
  writeStorage(LAST_PLAY_KEY, playId)
}

export function clearLastPlayId(): void {
  removeStorage(LAST_PLAY_KEY)
}
