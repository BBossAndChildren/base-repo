# 디자인 토큰 (시안)

> 검토용 시안이다. 확정되면 [05-ui-ux.md 1절](../development/05-ui-ux.md#1-디자인-시스템) 의 `TODO` 를 이 값으로 채운다.
> 실제 값은 [styles.css](styles.css) 맨 위 `:root` 에 있다. 이 문서와 CSS 가 다르면 CSS 를 기준으로 고치고 이 문서를 맞춘다.

## 1. 색 (라이트 테마)

콘셉트: **크림색 종이 위에 밤하늘 남색 글씨, 노을 주황 강조, 별빛 금색 장식.** "어린 왕자" 그림책의 따뜻한 느낌을 주되 글자는 진하게 해서 읽기 쉽게 한다.

| 토큰 | 값 | 용도 |
|------|----|------|
| `--color-bg` | `#FBF6EC` | 페이지 배경 (크림). **3D 체험 Unity `backgroundColor` 도 이 값** (불투명 6자리) |
| `--color-surface` | `#FFFFFF` | 카드 · 패널 · 입력칸 |
| `--color-surface-2` | `#F4ECDD` | 보조 면 — 나레이션 상자, 비활성 칩, 안내 상자 |
| `--color-text` | `#22283A` | 본문 |
| `--color-text-muted` | `#5E6475` | 보조 글자 (도움말, 날짜) |
| `--color-ink` | `#2B3A67` | 밤하늘 남색 — 제목, NPC 이름, 상태 패널 머리, 보조 버튼, 포커스 테두리 |
| `--color-accent` | `#B8502A` | 노을 주황 — 주요 버튼, 선택 강조 |
| `--color-accent-hover` | `#963F1F` | 주요 버튼 hover, 선택된 칩 글자 |
| `--color-accent-soft` | `#FBE7DA` | 선택된 칩 배경, 내 말풍선 |
| `--color-star` | `#E9B949` | 별빛 금색 — **장식 전용** (로고 별, 변경 강조 빛). 흰 배경 위 글자색으로 쓰지 않는다 |
| `--color-success` | `#2F7A4F` | 성공 · 저장 완료 |
| `--color-success-soft` | `#E6F2EA` | 성공 배지 배경 |
| `--color-warning` | `#8A5A00` | 주의 글자 |
| `--color-warning-soft` | `#FFF4D6` | 주의 배경 (효과음 안내, 진행 중 배지) |
| `--color-danger` | `#B3261E` | 오류 글자 · 입력 오류 테두리 |
| `--color-danger-soft` | `#FDECEA` | 오류 아이콘 배경 |
| `--color-border` | `#E3D8C5` | 카드 · 구분선 (장식용 테두리) |
| `--color-border-strong` | `#8C8270` | 입력칸 · 칩 테두리 (구분이 필요한 테두리) |
| `--color-disabled-bg` | `#E8E1D4` | 비활성 버튼 배경 |
| `--color-disabled-text` | `#5F5B53` | 비활성 버튼 글자 |
| `--color-focus` | `#2B3A67` | 키보드 포커스 테두리 (3px) |
| `--color-overlay` | `rgba(34,40,58,.55)` | 모달 뒤 어둡게 |

### 명도 대비 (WCAG 2.1 상대 휘도 공식으로 계산)

AA 기준: 본문 4.5:1, 큰 글자(24px 이상 또는 굵은 18.7px 이상) 3:1, 테두리 · 아이콘 같은 UI 요소 3:1.

| 글자 / 배경 | 대비 | 판정 |
|-------------|:---:|:---:|
| text `#22283A` / bg `#FBF6EC` | 13.61 | AA ✅ (AAA) |
| text / surface `#FFFFFF` | 14.66 | AA ✅ (AAA) |
| text / surface-2 `#F4ECDD` | 12.49 | AA ✅ (AAA) |
| text-muted `#5E6475` / bg | 5.48 | AA ✅ |
| text-muted / surface | 5.91 | AA ✅ |
| text-muted / surface-2 | 5.03 | AA ✅ |
| 흰 글자 / accent `#B8502A` (주요 버튼) | 4.98 | AA ✅ |
| 흰 글자 / accent-hover `#963F1F` | 6.94 | AA ✅ |
| accent / bg (강조 글자) | 4.62 | AA ✅ |
| accent-hover / accent-soft `#FBE7DA` (선택된 칩) | 5.79 | AA ✅ |
| text / accent-soft (내 말풍선) | 12.25 | AA ✅ |
| ink `#2B3A67` / surface | 11.03 | AA ✅ |
| 흰 글자 / ink (상태 패널 머리 · 새로운 일 배지) | 11.03 | AA ✅ |
| danger `#B3261E` / surface | 6.54 | AA ✅ |
| danger / bg | 6.07 | AA ✅ |
| success `#2F7A4F` / surface | 5.23 | AA ✅ |
| success / success-soft | 4.54 | AA ✅ |
| warning `#8A5A00` / surface | 5.93 | AA ✅ |
| disabled-text `#5F5B53` / disabled-bg `#E8E1D4` | 5.20 | AA ✅ (비활성은 기준 예외지만 읽히게 둠) |
| border-strong `#8C8270` / surface (입력칸 테두리) | 3.79 | UI 3:1 ✅ |
| border-strong / bg | 3.52 | UI 3:1 ✅ |
| star `#E9B949` / ink (어두운 배경 위 장식) | 6.04 | — |

- accent 를 accent-soft 위 글자로 쓰면 4.16 으로 미달 → 선택된 칩 글자는 **accent-hover** 를 쓴다
- `--color-border` `#E3D8C5` 는 3:1 미만이라 **장식용 구분선에만** 쓴다. 입력칸처럼 경계를 알아봐야 하는 곳은 `--color-border-strong`
- 색만으로 상태를 구분하지 않는다: 토스트는 아이콘(i · ! · ✓) + 왼쪽 띠, 선택 칩은 ✓ 표시, 상태 막대는 숫자 함께 표시

## 2. 글꼴

| 용도 | 글꼴 | 굵기 | 이유 |
|------|------|------|------|
| 제목 · 나레이션 | **Gowun Batang** (고운바탕) | 400 · 700 | 그림책 · 동화 같은 부드러운 바탕체. "어린 왕자" 이야기책 느낌을 주면서 획이 깔끔해 유치하지 않다 |
| 본문 · UI | **Noto Sans KR** | 400 · 500 · 700 | 작은 크기에서도 잘 읽히고 굵기가 다양하다. 채팅 · 입력 · 버튼처럼 오래 읽는 글에 맞다 |

- 둘 다 Google Fonts 에서 무료(OFL)로 쓸 수 있다
- 대체 글꼴: `"Apple SD Gothic Neo", "Malgun Gothic", sans-serif` / 제목은 `"Noto Serif KR", serif`
- Pretendard 는 Google Fonts 에 없어 이번 시안에서는 쓰지 않았다. 직접 호스팅이 가능하면 본문 후보로 검토할 수 있다
- 한국어 줄바꿈: `word-break: keep-all` (어절 단위)

```html
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
```

## 3. 글자 크기

| 토큰 | 값 | 용도 |
|------|----|------|
| `--text-xs` | 12px (0.75rem) | 캡션, 푸터, 말풍선 이름 |
| `--text-sm` | 14px (0.875rem) | 도움말, 칩, 토스트 |
| `--text-md` | 16px (1rem) | 본문, 말풍선, 입력 (모바일 확대 방지 위해 입력은 16px 이상) |
| `--text-lg` | 18px (1.125rem) | 나레이션, 카드 제목 |
| `--text-xl` | 22px (1.375rem) | 섹션 제목 |
| `--text-2xl` | 28px (1.75rem) | 페이지 제목 |
| `--text-3xl` | 36px (2.25rem) | 시작 화면 큰 제목, 상태 패널 나이 |

줄 간격: 본문 1.65, 제목 1.35.

## 4. 간격 (4px 단위)

| 토큰 | 값 |
|------|----|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |
| `--space-8` | 64px |

## 5. 모서리 · 그림자

| 토큰 | 값 | 용도 |
|------|----|------|
| `--radius-sm` | 6px | 작은 라벨, 포커스 |
| `--radius-md` | 12px | 입력칸, 말풍선, 토스트 |
| `--radius-lg` | 20px | 카드, 패널, 모달 |
| `--radius-pill` | 999px | 버튼, 칩, 배지 |
| `--shadow-sm` | `0 1px 2px rgba(34,40,58,.08)` | 카드 기본 |
| `--shadow-md` | `0 4px 14px rgba(34,40,58,.10)` | hover |
| `--shadow-lg` | `0 12px 32px rgba(34,40,58,.18)` | 토스트, 모달 |

## 6. CSS 변수 묶음

`05-ui-ux.md` 에 있던 이름(`--color-bg` · `--color-text` · `--color-accent` · `--color-danger`)은 그대로 쓰고 나머지를 더했다.

```css
:root {
  /* 색 */
  --color-bg: #FBF6EC;
  --color-surface: #FFFFFF;
  --color-surface-2: #F4ECDD;
  --color-text: #22283A;
  --color-text-muted: #5E6475;
  --color-ink: #2B3A67;
  --color-accent: #B8502A;
  --color-accent-hover: #963F1F;
  --color-accent-soft: #FBE7DA;
  --color-star: #E9B949;
  --color-success: #2F7A4F;
  --color-success-soft: #E6F2EA;
  --color-warning: #8A5A00;
  --color-warning-soft: #FFF4D6;
  --color-danger: #B3261E;
  --color-danger-soft: #FDECEA;
  --color-border: #E3D8C5;
  --color-border-strong: #8C8270;
  --color-disabled-bg: #E8E1D4;
  --color-disabled-text: #5F5B53;
  --color-focus: #2B3A67;
  --color-overlay: rgba(34, 40, 58, 0.55);

  /* 글꼴 */
  --font-heading: "Gowun Batang", "Noto Serif KR", serif;
  --font-body: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;

  /* 글자 크기 */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.375rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.25rem;

  /* 간격 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* 모서리 */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  /* 그림자 */
  --shadow-sm: 0 1px 2px rgba(34, 40, 58, 0.08);
  --shadow-md: 0 4px 14px rgba(34, 40, 58, 0.10);
  --shadow-lg: 0 12px 32px rgba(34, 40, 58, 0.18);
}
```

## 7. 반응형 기준

| 구간 | 너비 | 변화 |
|------|------|------|
| 데스크톱 | 1024px 이상 | 채팅 + 오른쪽 상태 패널(300px) |
| 태블릿 · 모바일 | 1024px 미만 | 상태 패널 → 헤더 아래 접이식 막대(`<details>`), 채팅 입력칸 하단 고정, 3D 체험은 가로 전체 |

다크 테마는 이번 시안 범위가 아니다.
