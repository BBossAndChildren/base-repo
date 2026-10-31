// 환경변수는 이 파일에서만 읽는다. 백엔드 주소를 코드에 직접 쓰지 않는다 (docs/development/05-ui-ux.md 4절)
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

// 인트로 에셋 폴더 (06-deployment.md 5-2-1). 백엔드 BE15 의 /intro-assets/ 에서만 받는다.
// VITE_INTRO_ASSET_BASE 를 비우면 백엔드 주소 + /intro-assets/, 둘 다 없으면 null (인트로를 띄우지 않음)
const introAssetBaseRaw = import.meta.env.VITE_INTRO_ASSET_BASE || (apiBaseUrl ? `${apiBaseUrl}/intro-assets/` : '')
const introAssetBase = introAssetBaseRaw ? (introAssetBaseRaw.endsWith('/') ? introAssetBaseRaw : `${introAssetBaseRaw}/`) : null

if (!useMock && !apiBaseUrl) {
  throw new Error('VITE_USE_MOCK=false 이면 VITE_API_BASE_URL 이 필요합니다')
}

export const env = {
  /** 백엔드 주소 (현재 Cloudflare Tunnel 주소). 예: https://xxxx.trycloudflare.com */
  apiBaseUrl,
  /** true 면 백엔드 대신 mock 응답을 쓴다. 기본 true (백엔드 게임 API 구현 전) */
  useMock,
  /** 인트로 에셋 폴더 주소 (끝에 /, intro.json 과 models/). 설정되지 않으면 null — 인트로를 띄우지 않는다 */
  introAssetBase,
} as const
