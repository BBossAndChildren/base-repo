// 환경변수는 이 파일에서만 읽는다. 백엔드 주소를 코드에 직접 쓰지 않는다 (docs/development/05-ui-ux.md 4절)
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

if (!useMock && !apiBaseUrl) {
  throw new Error('VITE_USE_MOCK=false 이면 VITE_API_BASE_URL 이 필요합니다')
}

export const env = {
  /** 백엔드 주소 (현재 Cloudflare Tunnel 주소). 예: https://xxxx.trycloudflare.com */
  apiBaseUrl,
  /** true 면 백엔드 대신 mock 응답을 쓴다. 기본 true (백엔드 게임 API 구현 전) */
  useMock,
} as const
