import react from '@vitejs/plugin-react'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const LOCAL_BUILD_ROUTE = '/local-builds/career-suite-integration-v005/'
// 다른 위치의 빌드를 쓰려면 UNITY_BUILD_DIR 로 지정한다
const LOCAL_BUILD_DIR = resolve(process.env.UNITY_BUILD_DIR ?? resolve(__dirname, '../docs/unity/webgl/site'))
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

/**
 * 개발 서버 전용: Unity 테스트 빌드(docs/unity/webgl/site, Git 제외)를 mock 의 buildUrl 경로로 제공한다.
 * 배포에서는 백엔드 서버 Nginx 가 /builds/ 로 제공한다 (docs/development/06-deployment.md 5-1)
 */
function localUnityBuild(): Plugin {
  return {
    name: 'local-unity-build',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(LOCAL_BUILD_ROUTE, (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '/').split('?')[0])
        const file = normalize(join(LOCAL_BUILD_DIR, path === '/' ? 'index.html' : path))
        if (!file.startsWith(LOCAL_BUILD_DIR) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localUnityBuild()],
})
