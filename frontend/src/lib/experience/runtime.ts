import type { ExperienceRuntime, SupportedManifest } from '../../types/unity'

/**
 * Unity 연결 코드는 저장소에 복사하지 않고, 빌드에 함께 들어 있는 frontend/client.js 를 실행할 때 불러온다.
 * 빌드와 연결 코드의 버전이 항상 같아진다 (docs/development/05-ui-ux.md 4-1).
 * 배포 서버는 /builds/ 의 .js 에 CORS 허용 헤더가 필요하다 (06 5-1).
 */
export type RuntimeLoader = (buildUrl: string) => Promise<ExperienceRuntime>

export const loadRuntimeFromBuild: RuntimeLoader = (buildUrl) => import(/* @vite-ignore */ new URL('frontend/client.js', buildUrl).href)

export async function loadManifest(buildUrl: string, fetchImpl: typeof fetch = fetch): Promise<SupportedManifest> {
  const response = await fetchImpl(new URL('supported-manifest.json', buildUrl).href, { credentials: 'omit' })
  if (!response.ok) throw new Error(`MANIFEST_HTTP_${response.status}`)
  const manifest = (await response.json()) as SupportedManifest
  if (!manifest?.build?.build_id || !Array.isArray(manifest.supported)) throw new Error('INVALID_MANIFEST')
  return manifest
}

/** buildUrl 을 절대 주소로 (상대 경로 mock 주소 대비), 끝에 / 보장 */
export function absoluteBuildUrl(buildUrl: string): string {
  const url = new URL(buildUrl, window.location.href)
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}
