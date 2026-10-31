import { readStorage, writeStorage } from './storage'

const KEY = 'adult-prince.playSessions'

function readAll(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(readStorage(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/**
 * 플레이별 Unity sessionId (03 1-2 게임 시작 응답). 3D 체험 연동(8단계)에 쓴다.
 * 재개 API(1-7)가 sessionId 를 주지 않아 시작할 때 받아 둔다.
 */
export function savePlaySession(playId: string, sessionId: string): void {
  writeStorage(KEY, JSON.stringify({ ...readAll(), [playId]: sessionId }))
}

export function getPlaySession(playId: string): string | null {
  return readAll()[playId] ?? null
}
