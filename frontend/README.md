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

- Root Directory: `frontend`
- 환경변수 `VITE_API_BASE_URL` 에 현재 터널 주소. 주소가 바뀌면 바꾸고 재배포한다
- `vercel.json`: 새로고침 시 404 를 막는 SPA rewrite
