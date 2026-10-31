# 디자인 — 어른왕자 웹 프론트

> **확정 디자인이다.** Unity 담당이 인트로 화면(FE11)에서 뽑은 디자인 토큰 `career-intro-component-tokens-v001` 을 웹 프론트 전체에 쓴다 ([12 결정 26](../development/12-decisions.md)).
> 이전 "그림책" 시안(크림 · 남색 · 주황, 고운바탕)은 폐기했다. 화면 구성 · 문구의 기준은 계속 [05-ui-ux.md](../development/05-ui-ux.md) 다.

## 디자인 콘셉트

- **어두운 청록 공간 위의 밝은 민트.** 인트로("가능성이 펼쳐지는 공간")에서 시작 화면 · 게임 · 결말까지 같은 분위기로 이어진다
- 배경 `#101e24` (인트로 화면 바탕), 글자 `#edf7ef`, 주요 버튼은 연한 민트 `#d9efdb` 위에 진한 초록 글자 `#18362e`, 포커스 · 강조는 `#b5edce`
- 글꼴은 **Pretendard** 하나 (제목 · 본문 공통). 버튼 · 칩은 pill 모양
- 진로 "판정"처럼 보이지 않게 결과 화면도 점수 · 순위 대신 "관심을 보인 일 · 다음에 경험해 볼 일"로 보여 준다 (기존 원칙 유지)

## 파일

| 파일 | 내용 |
|------|------|
| [tokens.json](tokens.json) | **디자인 토큰** (242개: primitive · semantic · component · responsive · breakpoint). Unity 담당 전달물 `career-intro-component-tokens-v001` 그대로 |
| `README.md` | 이 문서 — 콘셉트 · 앱 역할 변수 연결표 · 명도 대비 · 글꼴 |

- 이 폴더에는 **디자인 토큰과 디자인 안내만** 둔다. 전달물에 함께 왔던 인트로 v002 컴포넌트 · 생성 스크립트 · 템플릿 · 적용 안내 · 해시 목록은 코드로 옮긴 뒤 지웠다 (2026-11-01). 코드에서 쓰는 사본: `frontend/src/design/tokens/` (토큰 · 인트로 CSS 템플릿) · `frontend/scripts/build-tokens.mjs`
- 토큰 계층: primitive(원래 값) → semantic(글자 · 배경 · 버튼 · 포커스의 의미) → component(인트로 화면 부품) · responsive.compact(700px 이하). `{semantic.text.primary}` 처럼 서로 참조한다

## 코드에서 쓰는 방법

- 웹 프론트는 이 폴더를 직접 불러오지 않는다 (Vercel Root Directory 가 `frontend/`). **`frontend/src/design/tokens/tokens.json` 에 같은 파일을 두고** `npm run tokens` 로 CSS 변수(`--ci-*`)와 인트로 CSS 를 만든다 (`npm run build` 가 함께 실행)
- 토큰이 새로 오면: 이 폴더의 `tokens.json` 을 바꾸고 → 같은 파일을 `frontend/src/design/tokens/` 에 복사 → `npm run tokens` → 화면 확인. 인트로 CSS 템플릿이 함께 바뀌었으면 `frontend/src/design/tokens/CareerIntro.template.css` 도 바꾼다
- 앱 화면은 `--ci-*` 를 직접 쓰지 않고 `frontend/src/styles/global.css` 의 역할 변수(`--color-*` · `--font-*`)를 쓴다. 역할 변수가 아래 표처럼 토큰을 가리킨다

## 앱 역할 변수 ↔ 토큰

토큰은 인트로 전용이라 앱에 필요한 역할 중 일부는 토큰 값을 섞어(불투명하게) 만들었다. **토큰에 없는 값**은 굵게 표시했다.

| 역할 변수 | 값 | 토큰 / 만든 방법 | 용도 |
|-----------|----|------------------|------|
| `--color-bg` | `#101e24` | `semantic.surface.film` | 페이지 배경. **3D 체험 Unity `backgroundColor` 도 이 값** |
| `--color-surface` | `#1a282d` | `semantic.button.background` (`#ffffff0b`) 를 배경 위에 섞음 | 카드 · 헤더 · 입력칸 · 토스트 · 모달 |
| `--color-surface-2` | `#263339` | `#ffffff18` 를 배경 위에 섞음 | 나레이션 · 보조 면 · 비활성 |
| `--color-text` | `#edf7ef` | `semantic.text.primary` | 본문 · 제목 |
| `--color-text-muted` | `#bdcec7` | `semantic.text.secondary` | 보조 글자 |
| `--color-ink` | `#b5edce` | `semantic.focus.ring` | 강조 선 · NPC 이름 · 보조 버튼 테두리 · 선택된 세그먼트 |
| `--color-accent` | `#d9efdb` | `semantic.button.primaryBackground` | 주요 버튼 |
| `--color-on-accent` | `#18362e` | `semantic.button.primaryText` | 주요 버튼 · 민트 면 위 글자 |
| `--color-accent-hover` | `#b5edce` | `semantic.focus.ring` | 주요 버튼 hover, 선택된 칩 글자 |
| `--color-accent-soft` | `#2e3a3f` | `semantic.button.hoverBackground` (`#ffffff20`) 를 섞음 | 선택된 칩 · 내 말풍선 |
| `--color-star` | `#b5edce` | `semantic.focus.ring` | 장식 (로고 별 · 새로운 일) |
| `--color-border` | `#263339` | `#ffffff18` 를 섞음 | 장식용 구분선 |
| `--color-border-strong` | `#819b8c` | `primitive.color.textReplay` | 입력칸 · 칩 테두리 |
| `--color-focus` | `#b5edce` | `semantic.focus.ring` | 키보드 포커스 |
| `--color-danger` · `-soft` | **`#ff8a80`** · `#342e32` | 새 값 (어두운 배경 AA) | 오류 |
| `--color-success` · `-soft` | `#b5edce` · `#243739` | `semantic.focus.ring` + 섞은 배경 | 성공 · 저장 완료 (✓ 아이콘으로 강조색과 구분) |
| `--color-warning` · `-soft` | **`#f2c879`** · `#323731` | 새 값 (어두운 배경 AA) | 주의 · 진행 중 |
| `--color-disabled-bg` · `-text` | `#263339` · **`#8fa49a`** | 섞은 배경 + 새 값 | 비활성 버튼 |
| `--color-overlay` | `rgba(0, 0, 0, 0.6)` | **새 값** | 모달 뒤 |
| `--font-heading` · `--font-body` | `"Pretendard", "Malgun Gothic", system-ui, sans-serif` | `primitive.font.family` | 모든 글자 |
| `--radius-pill` | `999px` | `primitive.radius.pill` | 버튼 · 칩 · 배지 |

모서리(6 · 12 · 20px) · 간격(4px 단위) · 글자 크기 단계는 토큰에 앱용 값이 없어 이전 값을 유지한다.

### 명도 대비 (WCAG 2.1, 계산값)

AA 기준: 본문 4.5:1, 큰 글자 3:1, 테두리 · 아이콘 3:1.

| 글자 / 배경 | 대비 | 판정 |
|-------------|:---:|:---:|
| text `#edf7ef` / bg `#101e24` | 15.53 | AAA |
| text / surface `#1a282d` | 13.82 | AAA |
| text / surface-2 `#263339` | 11.86 | AAA |
| text-muted `#bdcec7` / surface | 9.25 | AAA |
| text-muted / surface-2 | 7.94 | AAA |
| on-accent `#18362e` / accent `#d9efdb` (주요 버튼) | 10.78 | AAA |
| on-accent / accent-hover `#b5edce` | 9.94 | AAA |
| ink `#b5edce` / surface | 11.53 | AAA |
| accent-hover / accent-soft `#2e3a3f` (선택된 칩) | 8.91 | AAA |
| text / accent-soft (내 말풍선) | 10.68 | AAA |
| danger `#ff8a80` / surface | 6.64 | AA |
| danger / danger-soft `#342e32` | 5.81 | AA |
| success `#b5edce` / success-soft `#243739` | 9.50 | AAA |
| warning `#f2c879` / surface | 9.61 | AAA |
| warning / warning-soft `#323731` | 7.71 | AAA |
| disabled-text `#8fa49a` / disabled-bg `#263339` | 4.92 | AA |
| border-strong `#819b8c` / surface (입력칸 테두리) | 5.05 | UI 3:1 ✅ |

- 색만으로 상태를 구분하지 않는다: 토스트는 아이콘(i · ! · ✓) + 왼쪽 띠, 선택 칩은 ✓, 상태 막대는 숫자 함께 표시
- 다크 화면 하나만 쓴다 (라이트 테마 없음)

## 글꼴

- **Pretendard** (OFL). Google Fonts 에 없어 jsDelivr CDN 의 고정 버전(dynamic subset)으로 불러온다 (`frontend/index.html`). 불러오지 못하면 `Malgun Gothic` · 시스템 글꼴로 대체
- 한국어 줄바꿈: `word-break: keep-all`
