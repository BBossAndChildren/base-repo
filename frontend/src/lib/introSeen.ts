import { env } from './env'

// 사이트를 열거나 새로고침할 때마다 인트로를 보여 준다 (2026-11-01 사용자 요청, #178).
// "본 기록"은 저장소에 남기지 않고 이 페이지를 불러온 동안만 메모리에 둔다 → 새로고침 · 새 탭이면 다시 보인다.
// 사이트 안에서 시작 화면으로 돌아올 때(같은 페이지)는 다시 틀지 않는다
let seenThisLoad = false
// 불러오기 실패는 이번 탭 동안 생략 (새로고침마다 실패 안내가 뜨지 않게)
const SKIPPED_KEY = 'adult-prince.introSkippedThisVisit'

/** 인트로 에셋 주소가 설정되어 있는지. 없으면 인트로 화면 · 헤더 링크를 쓰지 않는다 (05-ui-ux.md 화면 0) */
export function introAvailable(): boolean {
  return env.introAssetBase !== null
}

/** 인트로를 시작 화면 전에 보여 줄지 (FE11, 05-ui-ux.md 화면 0): 이 페이지에서 아직 보지 · 건너뛰지 않았고, 이번 탭에서 실패하지 않았으면 */
export function shouldShowIntro(): boolean {
  return introAvailable() && !seenThisLoad && readSession(SKIPPED_KEY) !== '1'
}

/** 끝까지 봤거나 건너뜀 → 이 페이지에서는 다시 보여 주지 않는다. 새로고침 · 새 방문에는 다시 보여 준다 */
export function markIntroSeen(): void {
  seenThisLoad = true
}

/** 새로고침을 흉내 낸다 (테스트용) */
export function resetIntroForPageLoad(): void {
  seenThisLoad = false
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
