import { readStorage, removeStorage, writeStorage } from './storage'

const KEY = 'adult-prince.pendingExperience'

/** 종료 응답을 아직 받지 못한 체험 — 다음 체험을 시작할 때 정산한다 (10 4-5, 03 1-8) */
export interface PendingExperience {
  playId: string
  sessionId: string
  experienceId: string
  roomId: string
}

export function getPendingExperience(): PendingExperience | null {
  try {
    const value = readStorage(KEY)
    return value ? (JSON.parse(value) as PendingExperience) : null
  } catch {
    return null
  }
}

export function setPendingExperience(value: PendingExperience): void {
  writeStorage(KEY, JSON.stringify(value))
}

export function clearPendingExperience(): void {
  removeStorage(KEY)
}
