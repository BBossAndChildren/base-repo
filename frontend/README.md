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
npm run build
```

## 환경변수

| 키 | 설명 |
|----|------|
| `VITE_API_BASE_URL` | 백엔드 주소 (현재 Cloudflare Tunnel 주소, 끝에 `/` 없이). `VITE_USE_MOCK=false` 일 때 필수 |
| `VITE_USE_MOCK` | `true`(기본): mock 응답 사용 · `false`: 실제 백엔드 호출 |

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
