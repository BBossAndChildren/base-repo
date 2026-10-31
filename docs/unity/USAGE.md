# Unity 자료 사용 안내 (우리가 관리)

> `docs/unity/` 의 다른 파일은 Unity 담당 전달물(목록 전달 v004 · 업데이트 v002)이며 **직접 고치지 않는다.** 새 버전이 오면 통째로 바꾸고 이 안내만 맞춘다.
> 우리 설계: [10-prompt-assembly.md 4절](../development/10-prompt-assembly.md#4-3d-체험-연동) · [03-api.md](../development/03-api.md) · [05-ui-ux.md 4-1](../development/05-ui-ux.md#4-1-3d-체험-연결-unity) · [06-deployment.md](../development/06-deployment.md)
> 상태 (2026-10-31): 실서비스 빌드 `career-suite-integration-v005` · 테스트 빌드 `career-suite-test-v009`, 71개 방 · 555개 체험 조합. 모든 조합이 "이번 빌드 미검증"이며 실서비스 백엔드 연결 · 정산(v003)은 미구현.

## 누가 무엇을 쓰나

| 파일 | 내용 | 프론트 | 백엔드 | AI |
|------|------|:---:|:---:|:---:|
| `README.md` · `UPDATES.md` · `manifest.json` | Unity 담당 전달 안내 · 변경 사항 · 파일 목록 | ✅ | ✅ | |
| `frontend/Experience.jsx` · `client.js` · `client.d.ts` | React 에 붙이는 Unity 연결 컴포넌트 · 클라이언트 · 타입 | ✅ | | |
| `frontend/backend.js` · `backend.d.ts` | 우리 백엔드 API 를 부르는 어댑터 (이벤트 · 정산 · 생존 신호 · 미수신 기록) | ✅ | 형식 참고 | |
| `frontend/audio.js` · `audio-ui.*` · `audio.d.ts` | 효과음 재생기 | ✅ | | |
| `frontend/environment.d.ts` · `progress.types.ts` | 타입 | ✅ | | |
| `frontend/README.md` · `docs/bridge-v003.md` · `docs/audio-api-v001.md` | 연결 · 효과음 사용 설명 | ✅ | | |
| `frontend/integration-example.*` · `react-example.jsx` · `server.mjs` · `suite-*` · `package.json` · `vite.config.js` | 로컬 테스트용 예제 · 테스트 수신기 (실서비스에 쓰지 않음) | 참고 | | |
| `examples/start-request.example.json` · `end-request.example.json` | 프론트 → Unity 시작 · 종료 호출 | ✅ | | |
| `contracts/realtime-v002/` | 실시간 이벤트 종류 · 필수 필드 · 중복 제거 · 순서 규칙 | ✅ | ✅ | |
| `contracts/reconciliation-v003/` | 종료 응답 미수신 정산 규칙 · 요청 · 응답 스키마 · 16개 확인 사례 | ✅ (요청 · 표시) | ✅ (구현) | |
| `contracts/CONTRACT-SNAPSHOT.md` · `envelope-v001.types.ts` | 규칙 원문 · 이벤트 봉투 타입 | 참고 | ✅ | |
| `backend/README.md` · `service-configuration-required.json` | 백엔드가 구현 · 제공해야 할 것 목록 | | ✅ | |
| `builds/production-supported-manifest.json` | 실서비스 빌드 허용 목록 (555개) | ✅ (`manifest` prop) | ✅ (추천 검증) | |
| `builds/production-ai-build-catalog.json` | 체험별 `jobs` · `description` (AI 선택 근거) | | ✅ (후보 20개로 줄임) | ✅ (백엔드가 보낸 후보로 선택) |
| `builds/test-*.json` | 테스트 빌드용 같은 목록 | 테스트 | 테스트 | |
| `ids/career-experience-descriptions-v001.json` | 체험 설명 전체 원본 | | 참고 | |
| `webgl/` | 테스트용 실행 빌드. **Git 에 올리지 않는다** (`.gitignore`). 최종 빌드는 백엔드 서버 `/srv/builds/` 에서 제공 | 로컬 테스트 | 배포 참고 | |

- AI 서버는 이 폴더의 파일을 직접 읽지 않는다. 백엔드가 카탈로그에서 고른 후보를 요청에 담아 보낸다
- `buildId` + `roomId` + `scenarioId` + `scenarioVersion` 네 값은 대소문자까지 정확해야 한다. `roomId` 는 `PAN-NNN` 형식
- 이전 빌드 목록으로 새 빌드를 대조하지 않는다

## 정리 기록

- 2026-10-31: 받은 패키지에서 검수 증거(`actual/` · `adapter-validation/`), 효과음 메타데이터(`audio/`, 실제 mp3 는 빌드 `site/audio/` 에 있음), 에셋 보고서(`catalogs/`), 이전 빌드 목록과 같은 내용의 버전 이름 사본(`builds/earlier-builds/` · `builds/career-suite-*`), 빌드된 테스트 화면(`frontend/compiled/`), 다른 형식의 ID 목록(`ids/` 나머지), Unity 내부 기록(`docs/` 나머지)을 제거했다. Unity 원본 README 에는 이 파일들이 언급돼 있다
- `webgl/` 은 아직 예전 빌드(`career-pilot-v007`)다. 새 빌드 `career-suite-integration-v005.zip` 으로 교체 예정 ([11 F8](../development/11-open-issues.md#f-확인이-필요한-질문))
