# 디자인 시안 — 어른왕자 웹 프론트

> **검토용 시안(초안)이다. 최종 디자인이 아니다.** 팀 검토 후 확정되면 [05-ui-ux.md](../development/05-ui-ux.md) 1절(폰트 · 디자인 토큰)의 `TODO` 를 채우고, 실제 화면은 `frontend/` (React + Vite + TypeScript) 에서 다시 만든다.
> 화면 구성 · 문구의 기준은 [05-ui-ux.md](../development/05-ui-ux.md) · [01-user-flow.md](../development/01-user-flow.md) · [10-prompt-assembly.md 4-4](../development/10-prompt-assembly.md#4-4-오류-안내-문구) 이다. 시안과 문서가 다르면 문서가 우선이다.

## 디자인 콘셉트

- **"어린 왕자" 그림책 같은 따뜻함 + 요즘 앱처럼 읽기 쉬운 화면.** 크림색 종이 배경, 밤하늘 남색 글씨, 노을 주황 버튼, 별빛 금색 장식
- 제목 · 나레이션은 동화책 느낌의 바탕체(고운바탕), 대화 · 버튼은 잘 읽히는 고딕(Noto Sans KR)
- 성장 이야기(coming-of-age)의 희망적인 분위기. 다만 캐릭터 그림 · 과한 장식은 넣지 않아 유치하지 않게 한다
- 진로 "판정"처럼 보이지 않도록 결과 화면도 점수 · 순위 대신 "이번 인생에서 관심을 보인 일 · 다음에 경험해 볼 일"로 보여 준다

## 파일

| 파일 | 내용 |
|------|------|
| [index.html](index.html) | 시안 목록 (여기서 시작) |
| [01-start.html](01-start.html) | 시작 화면 — 필수 4개, 선택 항목 2개(관심사 · 가치관) + 건너뛰기, 비활성 시작 버튼, 이어하기 카드 |
| [02-play.html](02-play.html) | 게임 화면 — 채팅(나레이션 · NPC · 나), 힌트 칩, 입력, 상태 패널(나이만 + 자리 표시), 3D 체험 안내 카드, 대기 · 시간 초과 · 3D 건너뜀 상태 |
| [03-experience.html](03-experience.html) | 3D 체험 전체 화면 — 불러오기 · 시작 · 체험 중 · 종료 저장 · 오류 모달 · 토스트 |
| [04-result.html](04-result.html) | 결말 화면 — 인생 요약, 해 본 일, 추천 직업 3개(새로운 일 1개), 안내 문구 |
| [05-history.html](05-history.html) | 지난 기록 (선택 기능) — 목록, 빈 상태 |
| [06-components.html](06-components.html) | 컴포넌트 시트 — 색 · 글자 · 버튼 · 입력 · 칩 · 토스트 · 모달 · 로딩 · 오류 화면 |
| [styles.css](styles.css) | 모든 시안이 함께 쓰는 CSS (토큰은 맨 위 `:root`) |
| [tokens.md](tokens.md) | 디자인 토큰 — 색(명도 대비 포함) · 글꼴 · 크기 · 간격 · 모서리 · 그림자 |

## 보는 방법

1. 이 폴더의 `index.html` 을 브라우저(Chrome · Edge 권장)로 **바로 연다** (파일 더블클릭). 서버 · 설치가 필요 없다
2. 모바일 배치는 창 너비를 1024px 아래로 줄이거나 개발자 도구의 기기 모드로 본다
3. 글꼴은 Google Fonts 에서 불러오므로 인터넷이 연결돼 있어야 시안 그대로 보인다 (끊기면 시스템 글꼴로 대체)

## 시안을 볼 때 알아 둘 것

- 점선 빗금 상자 **"시안 메모"** 는 검토자용 설명이다. 실제 화면에는 넣지 않는다
- 자바스크립트를 쓰지 않은 정적 화면이다. 버튼은 다른 시안으로 이동하는 링크 정도만 동작한다. 칩 선택 · 예/아니오 전환 · 모바일 상태 막대 펼치기는 CSS 만으로 흉내 냈다
- 대화 · 결말 · 추천 직업 문장은 [00-idea.md](../00-idea.md) 를 바탕으로 만든 **예시**다. 실제 문장은 AI 가 만들고 직업 정보는 직업백과 근거를 쓴다
- 게임 상태 패널은 **나이만 확정**이다. 자원 막대 자리는 회색 자리 표시로만 두었다 (`docs/game/03-rules.md` 확정 후 결정)
- React 로 옮길 때 대략 이렇게 나눈다: `Header` · `Footer` · `Button` · `TextField` · `Chip` · `Toast` · `Modal` · `Spinner` / `StartForm` · `ResumeCard` · `ChatLog` · `Message` · `ExperienceCard` · `HintChips` · `Composer` · `StatusPanel`(데스크톱) · `StatusBar`(모바일) · `ExperienceOverlay` · `JobCard`

## 시안 이후 문서에 반영된 결정 (2026-10-31)

시안 검토에서 나온 빈 곳은 설계 문서에 반영했다. 구현은 문서를 따른다.

- 3D 안내 카드: `experience.title` · `jobs` · `reason` 표시, [다음에 할게요] 추가 ([05 화면 2](../development/05-ui-ux.md#화면-2-게임-playplayid))
- 3D 체험: 종료 대기 · 5초 무응답 처리 ([05 화면 3](../development/05-ui-ux.md#화면-3-3d-체험-게임-화면-위-전체-화면))
- 결말: 생성 중 로딩, 추천 근거 `basis` 표시 ([05 화면 4](../development/05-ui-ux.md#화면-4-결말-playplayidresult))
- 시작 화면: 나이 7~99, 상황 · 관심사 · 가치관 보기, 진행 중일 때 [이어하기] / [새로 시작하기] ([03 1-2](../development/03-api.md#1-2-게임-시작))
- 정산 토스트 말투를 "~했어요" 로 통일
