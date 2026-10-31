# 어른왕자 웹 프론트

React + Vite + TypeScript. 설계 기준은 [docs/development/05-ui-ux.md](../docs/development/05-ui-ux.md), 작업 규칙은 [AGENTS.md](AGENTS.md).

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
npm run build
```

## 환경변수

| 키 | 설명 |
|----|------|
| `VITE_API_BASE_URL` | 백엔드 주소 (현재 Cloudflare Tunnel 주소, 끝에 `/` 없이). `VITE_USE_MOCK=false` 일 때 필수 |
| `VITE_USE_MOCK` | `true`(기본): mock 응답 사용 · `false`: 실제 백엔드 호출 |

## API 와 mock

- 화면은 `src/api` 의 `gameApi` 만 쓴다. `VITE_USE_MOCK` 에 따라 mock(`src/mocks/mockGameApi.ts`) 또는 실제 백엔드(`src/api/httpGameApi.ts`)가 쓰인다
- 실패는 모두 `ApiError`(`type` · `message`)로 온다. `message` 는 화면에 그대로 보여 줄 수 있는 문구다 (05-ui-ux.md 5절)
- mock 은 메모리에만 저장한다 (새로고침하면 플레이가 사라짐). 채팅에 아래 단어를 넣으면 상황을 흉내 낸다

| 입력에 포함 | 흉내 내는 상황 |
|-------------|----------------|
| `체험` | 3D 체험 분기 (`experience`) |
| `없는체험` | 맞는 체험 없음 (`notice`) |
| `끝` | 인생 종료 (`ended: true`) → 결말 조회 가능 |
| `오류` | AI 서버 실패 (502) |
| `느려` | 시간 초과 (504) |

## 3D 체험 (로컬 개발)

- mock 의 3D 체험은 `/local-builds/career-suite-integration-v005/` 를 빌드 주소로 쓴다. 개발 서버(`npm run dev`)가 이 경로로 `docs/unity/webgl/site` 를 제공한다 (Git 에 없음 — Unity 담당에게 받아 둔다)
- 다른 위치의 빌드를 쓰려면 `UNITY_BUILD_DIR=<site 폴더 경로> npm run dev`
- Unity 연결 코드는 빌드의 `frontend/client.js` 를 실행할 때 불러온다 (저장소에 복사하지 않음)

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
| `src/pages/` | 화면 (시작 · 게임 · 결말 · 지난 기록) |
| `src/lib/` | 환경변수 등 공통 유틸 |
| `src/types/` | API · 도메인 타입 |

## 배포 (Vercel)

| 설정 | 값 |
|------|-----|
| 저장소 | `BBossAndChildren/base-repo` |
| Root Directory | `frontend` |
| 빌드 · 출력 | `vercel.json` 에 있음 (`npm ci` → `npm run build` → `dist`) |
| 배포 조건 | `frontend/` 가 바뀐 커밋만 배포한다 (`ignoreCommand`). `docs/` 만 바뀐 커밋은 건너뛴다 |
| 새로고침 404 방지 | `vercel.json` 의 SPA rewrite |

**환경변수**

| 상황 | `VITE_USE_MOCK` | `VITE_API_BASE_URL` |
|------|-----------------|---------------------|
| 지금 (백엔드 게임 API 없음) | `true` | 비워 둔다 (쓰지 않음) |
| 실제 백엔드 연결 후 | `false` | 현재 터널 주소 (`https://….trycloudflare.com`, 끝에 `/` 없이). 터널 주소가 바뀌면 바꾸고 **재배포** |

환경변수는 빌드할 때 들어가므로, 바꾼 뒤에는 반드시 Redeploy 한다.

**mock 배포의 한계**
- 플레이 기록은 브라우저 메모리에만 있어 **새로고침하면 진행 중 플레이가 사라진다** ("인생을 찾을 수 없어요" 안내 후 새로 시작)
- 3D 체험 빌드는 배포 사이트에 없어, [체험 시작] 을 누르면 "3D 체험을 불러오지 못했어요" 안내 후 텍스트로 이어간다 (실제 3D 는 백엔드 서버의 `/builds/` 로 제공 — docs/development/06-deployment.md 5-2)

**배포 후 확인**
- [ ] 시작 화면 → 필수 4개 입력 → [인생 시작하기] → 게임 화면
- [ ] 채팅 · 힌트 · 나이 변화(세 턴마다) · "오류" 입력 시 토스트와 입력 유지
- [ ] "체험" 입력 → 3D 안내 카드 → [체험 시작] → 불러오지 못했어요 토스트 → 카드 접힘 (mock 배포 기준)
- [ ] "끝" 입력 → [결말 보기] → 추천 카드 3개 → [지난 기록 보기]
- [ ] 하위 주소(`/history`)에서 새로고침해도 404 가 아님
- [ ] `/dev/play` 같은 개발 전용 경로는 "페이지를 찾을 수 없어요"
