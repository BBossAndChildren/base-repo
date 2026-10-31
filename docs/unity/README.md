# Unity 3D 체험 연동 자료 안내

> Unity 담당이 전달한 자료다. **`tx/` · `integration/` 의 파일은 직접 고치지 않는다.** 바뀌면 Unity 담당이 새 버전으로 다시 전달한다.
> 우리 쪽 설계(백엔드 저장 · API · 프롬프트)는 [development/10-prompt-assembly.md 4절](../development/10-prompt-assembly.md#4-3d-체험-연동) · [development/03-api.md](../development/03-api.md) 에 있다.
> 상태 (2026-10-31): 실시간 전달 규격 확정, 중간 테스트용 체험 10개 동작 확인. 실서비스 백엔드 연결 · 종료 미수신 정산(v003)은 미구현.

## 폴더 구조

```
docs/unity/
├─ README.md        ← 이 문서 (우리가 관리)
├─ tx/              ← 송수신 명세 v003 (Unity 담당)
├─ integration/     ← 프론트 연결 코드 · 실제 실행 결과 예시 (Unity 담당)
│  ├─ INTEGRATION.md
│  ├─ frontend/
│  └─ examples/actual/
└─ webgl/           ← 테스트용 WebGL 빌드. Git 에 올리지 않음 (.gitignore). 최종은 백엔드가 전달
```

## 누가 무엇을 쓰나

| 파일 | 내용 | 프론트 | 백엔드 |
|------|------|:---:|:---:|
| `integration/INTEGRATION.md` | 연결 방법 · 저장 ACK · 재전송 책임 · 결과 읽는 법 · 종료 미수신 처리 | ✅ | ✅ |
| `integration/frontend/Experience.jsx` · `client.js` · `client.d.ts` | React 에 붙이는 Unity 연결 컴포넌트 · 클라이언트 · 타입 (iframe 로더, 이벤트 수신, 전송 큐) | ✅ | |
| `integration/frontend/example.html` · `react-example.*` · `host.js` · `server.mjs` · `package.json` | 로컬 테스트용 예제와 테스트 수신기 (실서비스에 쓰지 않음) | 참고 | |
| `tx/start-request.example.json` · `end-request.example.json` | 프론트 → Unity 체험 시작 · 종료 호출 형식 | ✅ | |
| `tx/realtime-contract.json` · `realtime-events.example.json` | Unity 가 실시간으로 보내는 이벤트 종류 · 필수 필드 · 중복 제거 · 순서 규칙 | ✅ | ✅ |
| `tx/career-integration-registry-v001.json` | 방 71개 · 시나리오 552개 · 실행 연결 21개의 고정 ID 목록 (참고용, 실행 허용 목록 아님) | | ✅ |
| `tx/interruption-contract.json` · `reconcile-request.example.json` · `resolution-response.schema.json` · `resolution-responses.example.json` | 종료 응답이 오지 않은 체험을 백엔드가 정산하는 규칙 · 요청 · 응답 형식 (v003) | ✅ (요청 보내기 · 응답 표시) | ✅ (정산 구현) |
| `tx/acceptance-cases.json` | 정산 구현 때 확인할 16개 사례 | | ✅ |
| `tx/PROTOCOL-SNAPSHOT.md` | 위 규칙 전체 원문 (막힐 때 참고) | 참고 | 참고 |
| `tx/MANIFEST.json` | 명세 파일 목록 · 해시 (버전 확인용) | | |
| `integration/examples/actual/*.json` | 실제로 체험을 돌려 받은 이벤트 원본 (완료 · 중단 · 초기화, 직업 10개) | 테스트 | DB 설계 · 테스트 |
| `webgl/README.md` · `manifest.json` · `site/` | 테스트용 빌드와 지원 체험 10개 목록 | 로컬 테스트 | 빌드 배포 참고 |

## 지금 실행되는 체험 (buildId `career-pilot-v007`, 버전 모두 `v002`)

| 직업 | roomId | scenarioId |
|------|--------|-----------|
| 행사기획자 | PAN-002 | career-net-951-experience |
| 가구조립 및 검사원 | PAN-019 | career-net-1152-experience |
| 사서 | PAN-035 | career-net-268-experience |
| 광고디자이너 | PAN-027 | career-net-285-experience |
| 물류관리사 | PAN-053 | career-net-215-experience |
| 원예기술자 | PAN-041 | career-net-963-experience |
| 제과사 및 제빵사 | PAN-025 | career-net-172-experience |
| 사진작가 | PAN-030 | career-net-310-experience |
| 방송연출가 | PAN-031 | career-net-301-experience |
| 방송장비(H/W)설치 및 수리원 | PAN-020 | career-net-1147-experience |

- `roomId` 는 `PAN-NNN` 형식이며 대소문자까지 정확해야 한다. `office` 같은 별칭은 받지 않는다
- Unity 는 `buildId` + `roomId` + `scenarioId` + `scenarioVersion` 네 값이 모두 맞아야 체험을 시작한다
- 레지스트리의 나머지 시나리오는 아직 실행 구현 전이다

## 정리 기록

- 2026-10-31: `integration/` 에서 `tx/` 와 같은 사본(`contracts/v003/`), 검수 증빙(`evidence/`), 빌드된 React 예제 번들(`react-example/`), 원래 폴더 구조용 실행 파일(`START.cmd`)을 제거했다. `integration/INTEGRATION.md` 본문에는 이 폴더들이 아직 언급돼 있다 (Unity 담당 원본이라 고치지 않음)
