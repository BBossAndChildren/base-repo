import { env } from './env'
import { readStorage, writeStorage } from './storage'

const SEEN_KEY = 'adult-prince.introSeen'
const SKIPPED_KEY = 'adult-prince.introSkippedThisVisit'

/** 인트로 에셋 주소가 설정되어 있는지. 없으면 인트로 화면 · 헤더 링크를 쓰지 않는다 (05-ui-ux.md 화면 0) */
export function introAvailable(): boolean {
  return env.introAssetBase !== null
}

/** 인트로를 시작 화면 전에 보여 줄지 (FE11, 05-ui-ux.md 화면 0) */
export function shouldShowIntro(): boolean {
  return introAvailable() && readStorage(SEEN_KEY) !== '1' && readSession(SKIPPED_KEY) !== '1'
}

/** 끝까지 봤거나 건너뜀 → 다음 방문부터 보여 주지 않는다 */
export function markIntroSeen(): void {
  writeStorage(SEEN_KEY, '1')
}

/** 불러오기 실패 → 이번 방문(탭) 동안만 생략. 에셋이 나중에 배치되면 다음 방문에 다시 시도한다 */
export function skipIntroThisVisit(): void {
  try {
    window.sessionStorage.setItem(SKIPPED_KEY, '1')
  } catch {
    // 저장소를 못 쓰면 다음 이동 때 다시 시도한다
  }
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}
