# AI 작업 규칙 (반드시 지킬 것)

> 이 파일이 AI 작업 규칙의 **원본**이다. `CLAUDE.md` 는 `@AGENTS.md` 로 이 파일을 불러오기만 한다. 규칙을 바꿀 때는 이 파일만 고치고, `CLAUDE.md` 에 내용을 복사하지 않는다.

이 저장소에서 코드를 추가·수정·머지하는 AI 에이전트는 **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) 의 규칙을 반드시 따른다.**
작업을 시작하기 전에 그 문서를 먼저 읽는다. 사용자가 규칙과 다르게 요청하면, 어떤 규칙과 다른지 알려 주고 확인을 받은 뒤에만 진행한다.

백엔드 작업은 **[docs/development/backend.md](docs/development/backend.md)의 기능별 구현·테스트 순서도 반드시 따른다.** API 명세에서 기능을 먼저 목록화하고, 기능 하나를 구현할 때마다 해당 테스트를 작성·실행한다. 통과 결과를 기록한 뒤에만 다음 기능으로 넘어간다. 테스트 실패·미실행·외부 연동 미검증을 완료로 표시하지 않는다.

문서 위치는 [docs/README.md](docs/README.md) 를 따른다 (개발 설계 = `docs/development/`, 게임 콘텐츠 = `docs/game/`).
개발 설계 문서를 만들거나 채울 때는 **[docs/development/FILL-GUIDE.md](docs/development/FILL-GUIDE.md) 를 먼저 읽고 따른다.** 문서 구성은 아이디어에 맞게 추가·삭제·변경할 수 있으며, 바꾸기 전에 사용자에게 제안하고 확인받는다.

## 매 작업마다 지킬 순서

1. **이슈 먼저** — `.github/ISSUE_TEMPLATE/issue_template.md` 양식으로 이슈를 만든다. 제목은 `[FEAT]` · `[FIX]` · `[REFACTOR]` 로 시작
   라벨은 유형 1개(`feat` `fix` `hotfix` `refactor` `docs` `test` `chore`) + 영역(`be` = `backend/` · AI 서버, `fe` = `frontend/`)을 단다. PR 에도 같은 라벨
   `frontend/` · `backend/` 에서 작업할 때는 그 폴더의 `AGENTS.md` 도 먼저 읽는다
2. **브랜치** — `git pull origin develop` 후 develop 에서 `<접두어>/<kebab-case-요약>` 브랜치를 딴다 (긴급 배포 수정만 main 에서 `hotfix/`)
3. **커밋** — `<type>(<scope>): <내용> #<이슈번호>` (type: feat fix hotfix refactor docs test style chore / scope: be, fe 또는 생략 / 한국어 50자 이내, 마침표 없음)
4. **PR** — `.github/pull_request_template.md` 의 모든 섹션을 채운다. 제목은 커밋 형식과 같고, 본문에 `close #이슈번호`
5. **확인** — 머지 전에 테스트 · lint · build 를 실제로 실행해 통과를 확인하고, PR 체크리스트를 모두 체크한다. 실패하면 머지하지 않는다
6. **머지** — 승인 없이 작성자가 직접 머지한다. 머지 방식: 작업 PR(→ develop)·hotfix PR(→ main)은 **Squash and merge** (`gh pr merge --squash`, 커밋 제목은 PR 제목 그대로), 릴리스(develop → main)·동기화(main → develop)·`docs → develop` PR 은 **Create a merge commit** (`gh pr merge --merge`). `docs` 는 머지 후에도 계속 쓰는 장기 브랜치라 삭제하지 않는다. 이런 PR 을 Squash 하면 두 브랜치 이력이 갈라지므로 절대 Squash 하지 않는다. base 는 일반 작업 `develop`, hotfix `main`. hotfix 머지 후에는 `main → develop` 반영 PR 을 이어서 만든다

## 절대 하지 말 것

- `main` · `develop` 에 코드 직접 push (예외: `docs/` 문서만 바뀌는 커밋은 develop 직접 push 허용)
- API 키 · 비밀번호 · 토큰을 코드 · 문서 · 커밋 · PR · 이슈에 쓰기, `.env` 커밋
- 1 PR 에 여러 목적 섞기 (400줄 이하 권장)
- 다른 팀원 담당 영역의 코드 · 문서를 임의 수정 (이슈로 알린다)
- 테스트를 건너뛰고 머지하거나, 실패를 성공으로 보고하기
- `--force` push, 브랜치·이슈 삭제 등 되돌리기 어려운 작업을 사용자 확인 없이 하기
