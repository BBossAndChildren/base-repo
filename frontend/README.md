# 어른왕자 웹 프론트

React + Vite + TypeScript (Node.js 20.11 이상). 설계 기준은 [docs/development/05-ui-ux.md](../docs/development/05-ui-ux.md), 작업 규칙은 [AGENTS.md](AGENTS.md).

## 실행

```bash
cd frontend
npm install
cp .env.example .env.local   # 필요하면 값 수정
npm run dev                  # http://localhost:5173
```

## 확인 (PR 전 필수)

```bash
npm run lint        # oxlint, 경고도 실패로 처리
npm run typecheck
npm test            # Vitest
npm run build       # npm run tokens(디자인 토큰 생성) 포함
```

## 환경변수

| 키 | 설명 |
|----|------|
| `VITE_API_BASE_URL` | 백엔드 주소 (현재 Cloudflare Tunnel 주소, 끝에 `/` 없이). `VITE_USE_MOCK=false` 일 때 필수 |
| `VITE_USE_MOCK` | `true`(기본): mock 응답 사용 · `false`: 실제 백엔드 호출 |
| `VITE_INTRO_ASSET_BASE` | 인트로 에셋 폴더 (끝에 `/`, 백엔드 BE15). 비우면 `VITE_API_BASE_URL` + `/intro-assets/`, 둘 다 비면 인트로를 띄우지 않는다 |

## API 와 mock

- 화면은 `src/api` 의 `gameApi` 만 쓴다. `VITE_USE_MOCK` 에 따라 mock(`src/mocks/mockGameApi.ts`) 또는 실제 백엔드(`src/api/httpGameApi.ts`)가 쓰인다
- 채팅은 `requestId`(UUID)를 보낸다. 실패한 문장을 그대로 다시 보내면 같은 ID, 고치거나 새 말이면 새 ID (mock 도 실제 백엔드처럼 필수 · 같은 ID 는 저장한 응답)
- 실패는 모두 `ApiError`(`type` · `message`)로 온다. `message` 는 화면에 그대로 보여 줄 수 있는 문구다 (05-ui-ux.md 5절)
- mock 은 플레이를 메모리에만 저장한다 (새로고침하면 플레이가 사라짐). 발급한 게스트는 실제 백엔드처럼 남도록 localStorage(`adult-prince.mockPlayers`)에 기억한다. 채팅에 아래 단어를 넣으면 상황을 흉내 낸다

| 입력에 포함 | 흉내 내는 상황 |
|-------------|----------------|
| `체험` | 3D 체험 분기 (`experience`) |
| `없는체험` | 맞는 체험 없음 (`notice`) |
| `끝` | 인생 종료 (`ended: true`) → 결말 조회 가능 |
| `오류` | AI 서버 실패 (502) |
| `느려` | 시간 초과 (504) |
| `충돌` | 생성 중 상태 변경 (409 `STATE_CONFLICT`) → 최신 상태 다시 조회 |

## 3D 체험 (로컬 개발)

- mock 의 3D 체험은 `/local-builds/career-suite-integration-v005/` 를 빌드 주소로 쓴다. 개발 서버(`npm run dev`)가 이 경로로 `docs/unity/webgl/site` 를 제공한다 (Git 에 없음 — Unity 담당에게 받아 둔다)
- 다른 위치의 빌드를 쓰려면 `UNITY_BUILD_DIR=<site 폴더 경로> npm run dev`
- Unity 연결 코드는 빌드의 `frontend/client.js` 를 실행할 때 불러온다 (저장소에 복사하지 않음)

## 디자인 토큰

- 디자인은 인트로에서 뽑은 토큰을 쓴다 (`docs/design/README.md`). 원본은 `src/design/tokens/tokens.json`
- `npm run tokens` 가 `src/design/tokens/tokens.css`(`--ci-*` 변수) · `tokenVariables.ts` · `src/pages/intro/CareerIntro.css` 를 만든다. **생성 파일은 직접 고치지 않는다**
- 화면 CSS 는 `--ci-*` 대신 `src/styles/global.css` 의 역할 변수(`--color-*` · `--font-*`)를 쓴다. 새 색이 필요하면 역할 변수를 추가하고 `docs/design/README.md` 표와 대비를 함께 고친다
- 글꼴 Pretendard 는 `index.html` 에서 jsDelivr 고정 버전으로 불러온다

## 인트로 (FE11)

- 처음 방문하면 `/` 에서 `/intro` 로 간다. 끝까지 보거나 [건너뛰기] 를 누르면 다음부터 생략한다 (localStorage `adult-prince.introSeen`). 다시 보려면 헤더 "인트로 다시 보기" 또는 이 값을 지운다
- 에셋(`intro.json` + `models/` 71개)은 백엔드 서버 `/intro-assets/`(BE15)에서만 받는다. 프론트 저장소에는 두지 않는다. 로컬에서 보려면 `.env.local` 에 `VITE_INTRO_ASSET_BASE=https://<터널 주소>/intro-assets/` 를 넣는다. 에셋 주소가 없으면 인트로 화면 · 헤더 "인트로 다시 보기" 를 쓰지 않고, 주소가 틀리면 "인트로를 불러오지 못해…" 토스트 후 시작 화면으로 간다
- 코드: `src/pages/intro/` — `CareerIntro.tsx` · `introEngine.ts` 는 원본(v002 토큰 판)을 옮긴 것이라 연출을 바꾸지 않는다. `CareerIntro.css` 는 생성 파일, `introGuard.css` 는 앱 전역 스타일 차단. Three.js(`three@0.180.0`)는 인트로 화면에서만 따로 불러온다

## 개발 전용 경로 (배포 빌드에는 없음)

| 경로 | 내용 |
|------|------|
| `/dev/components` | 공통 컴포넌트 |
| `/dev/play` | mock 대화가 있는 게임 화면. 채팅에 "체험" 을 넣으면 3D 체험까지 확인 |
| `/dev/result` | 결말 화면 |

## 폴더

| 폴더 | 내용 |
|------|------|
| `src/api/` | 백엔드 API 호출 (공통 모듈 · 엔드포인트별 함수) |
| `src/mocks/` | 백엔드 구현 전 mock 응답 (`docs/development/03-api.md` 예시 기준) |
| `src/components/` | 공통 컴포넌트 (버튼 · 토스트 · 모달 등) |
| `src/pages/` | 화면 (인트로 · 시작 · 게임 · 결말 · 지난 기록) |
| `src/lib/` | 환경변수 등 공통 유틸 |
| `src/design/tokens/` | 디자인 토큰 원본 · 생성 파일 |
| `src/styles/` | 전역 역할 변수 · 화면별 CSS |
| `src/types/` | API · 도메인 타입 |
| `scripts/` | 디자인 토큰 생성 (`npm run tokens`) |

## 배포 (Vercel)

| 설정 | 값 |
|------|-----|
| 저장소 | `BBossAndChildren/base-repo` |
| Root Directory | `frontend` |
| 빌드 · 출력 | `vercel.json` 에 있음 (`npm ci` → `npm run build` → `dist`) |
| 배포 조건 | `frontend/` 가 바뀐 커밋만 배포한다 (`ignoreCommand`). `docs/` 만 바뀐 커밋은 건너뛴다 |
| 새로고침 404 방지 | `vercel.json` 의 SPA rewrite |

**환경변수** (2026-11-01 부터 실제 백엔드 모드)

| 키 | 값 |
|----|----|
| `VITE_USE_MOCK` | `false` (mock 으로 되돌릴 때만 `true`) |
| `VITE_API_BASE_URL` | GPU 서버 터널 주소 (`https://….trycloudflare.com`, 끝에 `/` 없이). 현재 주소는 서버의 `grep trycloudflare.com ~/cloudflared.log` |
| `VITE_INTRO_ASSET_BASE` | 넣지 않는다 (`VITE_API_BASE_URL` + `/intro-assets/` 를 자동 사용) |

- **Type 은 `Config`** 로 만든다. `VITE_*` 는 브라우저 코드에 들어가는 공개 값이라 Vercel 이 Secret 으로는 저장을 막는다. 이미 Secret 이면 지우고 Config 로 다시 만든다. 비밀값(`AI_SERVER_KEY` 등)은 여기에 넣지 않는다
- 환경변수는 빌드할 때 들어가므로, 바꾼 뒤에는 반드시 **Redeploy** 한다. 터널 주소가 바뀌면 `VITE_API_BASE_URL` 만 바꾸고 Redeploy
- 상세 · 트러블슈팅: docs/development/06-deployment.md 5-4 · 7절

**현재 배포의 한계**
- 결말 화면은 AI 서버에 결말 API 가 아직 없어 오류가 난다. 3D 체험 추천도 AI 쪽 미구현이라 텍스트로 이어간다
- AI 가 한 번에 한 대화만 처리해 동시에 보내면 "잠시 후 다시 시도해 주세요"
- AI 실패(502 · 504) 때 Cloudflare 가 응답을 바꿔 "연결이 끊겼어요" 로 보일 수 있다 (docs 11 E3)

**배포 후 확인**
- [ ] 처음 방문(사이트 데이터 삭제 후): `/intro` → 71/71 → [인트로 재생] → 24초 뒤 시작 화면
- [ ] 글꼴이 Pretendard, 화면이 어두운 청록 · 민트 디자인
- [ ] 시작 화면 → 필수 4개 입력 → [인생 시작하기] → 게임 화면, 상태 패널에 원화 자금 · 건강 등
- [ ] 대화 → AI 대사 표시, 다음 턴에 이전 대화를 기억
- [ ] [일시정지] → 입력 잠금 → [이어 하기]
- [ ] 새로고침하면 마지막 대화부터 이어짐 (서버에 저장)
- [ ] 하위 주소(`/history`)에서 새로고침해도 404 가 아님
- [ ] `/dev/play` 같은 개발 전용 경로는 "페이지를 찾을 수 없어요"
