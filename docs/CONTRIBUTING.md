# 협업 규칙

> 이슈 → 브랜치 → 커밋 → PR → 머지 순서로 작업한다.
> 템플릿: `.github/ISSUE_TEMPLATE/issue_template.md`, `.github/pull_request_template.md` (생성 시 자동 적용)
> 담당자 자동 지정: `.github/workflows/auto-assign.yml` (이슈·PR 에 담당자가 없으면 작성자를 지정)

## 1. 작업 흐름

1. **이슈 생성** — 이슈 템플릿 사용, 제목은 `[FEAT]` · `[FIX]` · `[REFACTOR]` 로 시작, 라벨 = 유형 1개 + 영역(`be`/`fe`)
2. **브랜치 생성** — 최신 `develop` 에서 분기 (`git pull origin develop` 후)
3. **커밋** — 아래 커밋 컨벤션, 끝에 이슈 번호
4. **PR** — 템플릿 작성, 본문에 `close #이슈번호`
5. **머지** — 리뷰·승인 없이 작성자가 직접 머지 (체크리스트 확인 후)
6. **릴리스** — `develop → main` PR

## 2. 브랜치

```
main       ← 배포 브랜치. 직접 push 금지. develop → main PR 로만 병합 (긴급 수정은 hotfix/ 가 main 에서 분기)
 └ develop ← 통합 브랜치. 코드는 직접 push 금지(작업 브랜치 → develop PR). docs/ 문서 수정만 직접 push 허용
    ├ feature/be-auth
    ├ feature/fe-login
    └ refactor/fe-structure
```

| 접두어 | 용도 | 분기 → 병합 | 예 |
|--------|------|-------------|----|
| `feature/` | 기능 추가 | develop → develop | `feature/fe-login` |
| `fix/` | 버그 수정 | develop → develop | `fix/token-refresh` |
| `refactor/` | 동작 변경 없는 구조 개선 · UI/CSS 변경 · 파일 이름 변경/삭제 | develop → develop | `refactor/fe-structure` |
| `test/` | 테스트 추가·수정 | develop → develop | `test/auth-flow` |
| `docs/` | 문서만 (브랜치를 쓸 경우) | develop → develop | `docs/api-spec` |
| `chore/` | 설정·빌드·배포 | develop → develop | `chore/deploy` |
| `hotfix/` | 배포 환경 긴급 수정 | **main → main** (머지 후 develop 에도 반영) | `hotfix/cors-origin` |

- 이름은 `<접두어>/<작업-요약>`, 요약은 영문 소문자 + 하이픈(kebab-case)
- 접두어는 커밋 타입과 맞춘다 (`feature/` ↔ `feat`, `refactor/` ↔ `refactor`)
- **hotfix 는 main 머지 후 반드시 `main → develop` 반영** — 빠지면 다음 릴리스에서 버그가 되살아난다

### 2-1. GitHub 보호 규칙

| 브랜치 | 설정 |
|--------|------|
| `main` | Require a pull request before merging (Required approvals: **0**). 직접 push 금지 (예외 없음) |
| `develop` | Require a pull request before merging (Required approvals: **0**). `docs/` 문서만 수정하는 커밋은 직접 push 허용 → 보호 규칙에 팀원 bypass 지정 |

> 승인은 요구하지 않는다. PR 을 거치게만 해서 기록을 남기고, 머지는 작성자 본인이 한다.

### 2-2. docs 직접 push

| 항목 | 규칙 |
|------|------|
| 대상 | `docs/` 아래 문서만 바뀌는 커밋. 코드·설정 파일이 하나라도 섞이면 브랜치 + PR |
| 방법 | `develop` 에서 `git pull origin develop` 후 수정 → `origin develop` 에 push |
| 커밋 메시지 | `docs: 요약` 또는 `docs: vX.Y update` |
| 묶기 | push 전 문서 수정은 아직 push 하지 않은 docs 커밋 하나에 합친다 |
| `main` | 예외 없음. develop → main PR 로만 병합 |

## 3. 커밋

```
<type>(<scope>): <내용> #<이슈번호>

<본문(선택): 무엇을 왜 바꿨는지>
```

| 요소 | 규칙 |
|------|------|
| `type` | `feat` `fix` `hotfix` `refactor` `docs` `test` `style` `chore` |
| `scope` | `be`(백엔드) · `fe`(프론트) 두 가지만. 어느 쪽도 아니면 생략 (`docs: 내용`) |
| 내용 | 한국어, 50자 이내, 마침표 없음 |
| `#이슈번호` | 연결된 이슈가 있으면 끝에 `#5` 형식(앞자리 0 없음). 이슈 없는 문서·설정 작업은 생략 |
| 본문 | 제목만으로 이유가 드러나지 않으면 빈 줄 뒤에 작성 |

```
feat(be): 로그인 시 JWT 발급과 만료 시간 적용 #12
fix(fe): 401 수신 시 토큰 삭제 후 로그인 화면으로 이동 #6
refactor(fe): TypeScript 전환과 strict 설정 #5
docs: v1.7 update
```

본문이 있는 경우:
```
fix(fe): 한글 입력 중 Enter 중복 전송 수정 #14

IME 조합 중에는 keydown 이 두 번 발생해 마지막 글자가 중복 전송되던 문제.
composition 상태를 확인해 조합 중 Enter 는 무시하도록 변경.
```

**좋은 커밋 = 하나의 논리적 변경 + 동작하는 상태 + 설명 가능한 메시지**
- 오타 1글자, 공백/포맷만, 빈 커밋, 같은 내용 되돌리기 반복은 피한다
- author 이메일은 본인 GitHub 계정 이메일 (`git config user.email`)
- 페어 작업 시 `Co-authored-by:` 트레일러

## 4. Pull Request

### 4-1. 제목
커밋과 같은 형식: `<type>(<scope>): <변경 요약> #<이슈번호>`

### 4-2. 대상(base) 브랜치

| 작업 브랜치 | base | 비고 |
|-------------|------|------|
| `feature/*` `refactor/*` `fix/*` `docs/*` `chore/*` `test/*` | `develop` | 일반 작업 |
| `hotfix/*` | `main` | 머지 후 `main → develop` 반영 |
| (PR 없음) `docs/` 문서만 수정 | `develop` 직접 push | 코드·설정이 섞이면 브랜치 + PR |
| `develop` (릴리스) | `main` | 배포 시점, 태그 `v1.0.0`. 머지 후 `main → develop` 동기화 PR |

### 4-3. 크기와 범위
- 1 PR = 1 기능/1 목적. 변경 400줄 이하 권장 (문서·lock 파일 제외)
- 다른 기능 수정이 섞이면 PR 을 나눈다
- 작업 중 공유는 Draft PR, 준비되면 Ready for review

### 4-4. 리뷰와 머지

| 항목 | 규칙 |
|------|------|
| 리뷰·승인 | **필수 아님**. 필요하면 리뷰어를 지정해 의견을 받을 수 있다 |
| 머지 조건 | 테스트 통과 + 충돌 없음 + 체크리스트 완료 |
| 머지 주체 | PR 작성자가 직접 머지 |
| 머지 방식 | **모든 PR 은 Squash and merge 로 통일** (작업 → develop, hotfix → main, 릴리스 develop → main, 동기화 main → develop 모두). Squash 커밋 제목은 PR 제목(커밋 컨벤션 형식)을 그대로 쓴다 |
| 머지 후 | 연결 이슈 자동 종료 확인. 브랜치 삭제 여부는 팀이 정한다 |

> 저장소 Settings → General → Pull Requests 에서 **Allow squash merging 만 켜고** merge commit · rebase merging 은 끈다.
> Squash 는 base 에 새 커밋을 만들기 때문에, 릴리스·동기화 후에는 `develop` 과 `main` 의 이력이 갈라진다. 릴리스 PR 머지 직후 `main → develop` 동기화 PR 을 만들어 내용을 맞춘다.

### 4-5. 리뷰 코멘트 머리말 (리뷰를 남길 때)

| 머리말 | 의미 |
|--------|------|
| `[필수]` | 머지 전 반드시 수정 |
| `[제안]` | 더 나은 방법 제안, 작성자 판단 |
| `[질문]` | 의도 확인 |
| `[칭찬]` | 좋은 코드 공유 |

## 5. 라벨

`scripts/setup-labels.sh` 로 저장소에 한 번 생성한다. 이슈·PR 모두 **유형 1개 + 영역** 을 단다.

| 구분 | 라벨 |
|------|------|
| 유형 (커밋 type 과 같음) | `feat` `fix` `hotfix` `refactor` `docs` `test` `chore` |
| 영역 (커밋 scope 와 같음) | `be` `fe` |
| 상태 · 우선순위 | `priority: high` `blocked` `question` `wontfix` `duplicate` |

## 6. 기타

- **민감정보**: API 키·비밀번호는 코드·문서·채팅에 쓰지 않는다. 환경변수(`.env`)로 관리하고 `.env` 는 `.gitignore`. 저장소에는 키 이름만 담은 `.env.example` 을 둔다. `.env` 값은 직접 전달
- **충돌 방지**: 작업 시작 전 `git pull origin develop`. 공용 파일 수정 시 채널에 공지
- **인터페이스 우선 합의**: 프론트·백엔드 병렬 진행 시 API 문서를 먼저 확정하고, API 가 바뀌면 문서도 함께 수정
- **영역 존중**: 다른 사람 담당 영역의 코드·문서는 직접 고치지 않고 이슈로 알린다
- **이슈 관리**: GitHub Issues 로 관리, 담당자를 반드시 지정 (워크플로가 자동 보완)
