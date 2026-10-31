// 브라우저 저장소 접근. 사생활 보호 모드 등에서 실패해도 앱이 멈추지 않게 한다
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 저장 실패 시 이번 방문 동안만 메모리 값으로 동작한다
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 무시
  }
}
