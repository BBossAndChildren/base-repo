# 완성 체험 중간 테스트 전달 v001

최종 전달 폴더 모양으로 묶은 **중간 테스트용** 패키지다. 10개 기본 직업 체험을 기존 `career-pilot-v007` Unity WebGL 바이트로 실행한다. 새 Unity 빌드나 실서비스 배포가 아니다.

전달 폴더: `unity/webgl/packages/career-preview-v001/`. Windows에서 `START.cmd` 실행 후 표시되는 HTTP 주소를 연다. Node.js가 필요하며 설치할 npm 패키지는 없다. `file://` 더블클릭 실행은 지원하지 않는다.

## 포함 파일

- `site/`: 기존 Unity 실행본과 외부 호출 호스트. 컴파일된 data/wasm/framework/loader 바이트는 원본과 같다.
- `frontend/`: 프레임 로더, 원본 이벤트 수신·범위별 최신 스냅샷, 저장 ACK 전송 큐, 타입, React 컴포넌트, 로컬 테스트 수신기.
- `react-example/`: 빌드된 실제 React 최소 예제. 직업 선택 화면을 새로 만들지 않으며 URL의 scenarioId로 지정한다.
- `contracts/v003/`: 기존 계약의 고정 전달 사본. 예시는 가상이며 규칙 원장은 저장소 AGENTS.md다.
- `examples/actual/`, `evidence/`: 실제 실행 원본 JSON과 이번 검수 결과. 가상 계약 예시와 분리한다.
- `manifest.json`, `BUILD.md`, `README.md`: 지원 조합·출처·실행 방법·제약.

`career-preview-v001-webgl.zip`은 실행 WebGL, `career-preview-v001-integration.zip`은 React/백엔드 연결 코드·계약 전달용이다. 통합 폴더에는 두 범주의 파일을 함께 배치했다. Unity 편집 프로젝트·모델 원본·node_modules·검사용 스크립트는 전달 ZIP에 넣지 않는다.

## 지원 범위

manifest의 `supported`는 `career-integration-registry-v001.json`의 고정 ID·버전과 실제 v007 실행 결과로 만든 파생 허용 목록이다. 원본 레지스트리를 새로운 원장으로 관리하지 않는다. 외부 API는 buildId+roomId+scenarioId+scenarioVersion 네 값의 정확한 일치를 요구한다. occupationId/sceneId도 조회할 수 있다. `office` 별칭, 알 수 없는 버전, 다른 빌드를 거부한다.

행사기획자, 가구조립 및 검사원, 사서, 광고디자이너, 물류관리사, 원예기술자, 제과사 및 제빵사, 사진작가, 방송연출가, 방송장비(H/W)설치 및 수리원의 기본 체험 10개를 지원한다. 각 체험은 실제 물건 선택과 3개 작업면을 통해 완료한다.

기존 바이너리에는 11개 공간과 공용 사무실 비교 장면이 함께 들어 있다. **비지원 비교 장면을 물리적으로 제거한 새 컴파일은 하지 않았다.** 외부 호출 허용 목록은 위 10개다. standalone 공간 탐색 UI의 존재를 추가 체험 지원으로 해석하지 않는다. 71개 공간 탐색, 나머지 직업, 선택형 특수 분기와 전문 업무 정확성 보장은 포함하지 않는다. 명세·소스만 있는 체험은 manifest의 연결 보완/재검수 후보와 제외 목록으로 구분한다.

## 외부 React 연결

외부 서비스에서 `Experience.jsx`, `client.js`, `client.d.ts`를 가져간다. 이미 있는 직업 선택 UI가 `selection`을 넘기고 전체 플레이 동안 같은 `sessionId`를 유지한다. 시작마다 새 experienceId/requestId를 만든다. 내부 초기화는 Unity가 새 scenarioRunId를 만든다. React props와 콜백은 useMemo/useCallback 등으로 안정적으로 유지한다. React 컴포넌트를 새로 장착하면 새 실행을 시작하므로 단순 렌더 변경 때 재장착하지 않는다.

```js
const selection = manifest.supported.find(x =>
  x.buildId === 'career-pilot-v007' && x.roomId === 'PAN-002' &&
  x.scenarioId === 'career-net-951-experience' && x.scenarioVersion === 'v002');
// createExperienceClient가 리스너를 먼저 등록하고 ready 상태를 알린다.
await client.start(selection); // ready 이후에만 호출
const ended = await client.end();
// ended 원본을 보존하고 전송 큐의 저장 ACK를 확인한다.
// 화면 제거 전 종료 수신과 저장 성공을 서로 구분해 표시한다.
```

iframe URL에 `parentOrigin`을 외부 페이지의 정확한 origin으로 넣는다. 호스트는 origin과 source를 확인하고 Unity 준비 후에만 제어 요청을 전달한다. 수신기도 source/origin/protocol/schemaVersion/실행 ID/고정 조합을 확인한다. 임의 origin 와일드카드는 없다. 동일 출처 및 다른 출처 모두 이 postMessage 구조를 사용하지만 실제 외부 서비스의 CSP/frame-ancestors/인증 설정은 별도 확인 대상이다.

반환 이벤트는 원본 그대로 유지한다. frontend의 준비 전 호출·미지원 조합 등은 `error.code`가 있는 예외이고 Unity가 만든 이벤트가 아니다. Unity 제어 오류는 `experience.error`다. 같은 요청 재전송은 `client.retry(requestId)`를 사용한다. 새 requestId로 재종료하면 어댑터가 `ALREADY_ENDED`와 `originalEventId`를 안내한다. 기존 바이너리를 직접 우회 호출한 ALREADY_ENDED 응답은 원본 eventId를 제공하지 않으므로 이 패키지 API를 사용한다.

## 저장 ACK와 재전송 책임

`createOutbox({send})`의 send 함수만 기존 서비스의 인증/API 계약으로 교체한다. 패키지는 실제 endpoint나 비밀키를 가정하지 않는다. send는 해당 eventId/sessionId의 저장 완료를 확인한 뒤 `{stored:true, sessionId, eventId}`를 반환해야 한다. 단순 HTTP 전송 성공/접수 응답을 저장 ACK로 바꾸면 안 된다.

outbox는 localStorage에 원본 이벤트·상태·ACK를 보존하고 성공한 이벤트를 다시 합산하지 않는다. 실패는 pending 상태로 유지한다. 예제는 2초마다 flush하고 같은 eventId/sequence/occurredAt/내용을 재전송한다. 수신한 이벤트·최신 스냅샷은 클라이언트 메모리이며 outbox는 브라우저 저장 공간이다. 브라우저 데이터 삭제·저장 용량 초과·강제 종료 직전 미수신 데이터는 보장할 수 없다. 저장 예외는 조용히 성공 처리하지 않는다. 자동 서버 replay API는 없다. `client.replay()`는 살아 있는 동일 Unity 인스턴스의 기존 Replay 구현만 사용한다.

서버는 `(sessionId,eventId)`로 중복 제거하고 동일 ID/다른 내용은 충돌로 거부한다. 순서가 뒤집힌 원본도 저장하되 `(sessionId,experienceId,scenarioRunId,scope,interaction의 stepId/objectId/workItemId)`별 최신 sequence만 상태로 사용한다. 누적 process 값을 더하지 않는다. 최종 data.events/previousRuns.events는 이미 발생한 원장의 사본이며 재집계하지 않는다.

로컬 `/__local/events`는 **테스트 전용**이다. JSONL 파일 쓰기와 fsync 뒤 ACK하고 재시작 시 원장을 읽는다. 인증·멀티 프로세스 잠금·운영 DB·lease·정산 서버가 아니다. 단일 Node 프로세스만 사용한다. `local-receiver-data/`는 실행 시 생기는 개인 테스트 기록이며 전달 ZIP에 넣지 않는다. React 최소 예제는 수신만, 기본 테스트 페이지는 전송 큐와 로컬 디스크 ACK까지 검사한다.

## 결과 읽기

| 원본 필드 | 사람용 의미 |
|---|---|
| roomId / scenarioId / scenarioVersion / buildId | 실행한 고정 체험과 바이너리 |
| sessionId / experienceId / scenarioRunId | 전체 플레이 / 한 체험 / 초기화로 나뉜 실행 |
| process.attemptCount / mistakeCount / repeatedMistakeCount | 실제 제출 / 판정된 실수 / 같은 조건의 반복 실수 |
| process.navigationBackCount / backtrackCount | 화면 복귀 / 이전 업무 단계 재확인; 자동 실수 아님 |
| process.helpRequestCount / guidanceUsed / elapsedActiveMs | 도움 요청 / 실제 안내 제공 / 측정한 활성 시간 |
| result.outcome / success / completionCode | 진행 중·완료·실패·명시 중단과 업무 완료 여부 |
| context / context.termination | 근거 기반 설명·한계 / 종료 당시 완료·남은 업무 |
| data.events / eventsComplete / previousRuns | 현재 run 근거 / 전량 여부 / 이전 run 분리 원장 |

미측정은 null과 사유다. 초기화 이전 run을 현재 run에 더하지 않는다. 이미 완료한 업무는 종료 버튼으로 aborted가 되지 않는다. 직업 적성·지능·전문 자격 점수가 아니다. 실제 종료 JSON은 단독으로 읽을 수 있으며 examples/actual의 해당 실행 원장에서도 eventId를 조회한다.

## 종료 미수신 v003

종료 대기는 기본 5초다. 화면 제거·응답 없음은 pending_reconciliation이며 사용자 포기나 업무 실패가 아니다. 새 실행의 서버 정산은 구현하지 않았다. contracts/v003의 실제 계약·JSON Schema·16개 수용 사례를 백엔드 담당자에게 전달한다. 인증된 동일 소유자의 명시적 새 시작, lease 확인, 원자적 fence, 별도 experience.reconciled, 마지막 관측과 최종 결과 분리, 늦은 실제 종료의 revision 정정, 이중 집계 방지가 필요하다. 기본 heartbeat 30초/lease 120초를 클라이언트가 임의 실행·정산한 것으로 표시하지 않는다.

실서비스 연결에 필요한 정보: 기존 이벤트 저장 endpoint와 인증 방법, 저장 ACK 형태·멱등 충돌 규칙, 소유권/lease/정산 API, 허용 부모 origin/CSP, 데이터 보존 정책. 이 정보 없이도 패키지의 로컬 실행·수신 검수는 가능하다.

## 검수와 한계

이번 HTTP Chrome SwiftShader 검수와 실제 원본은 `docs/machine/evidence/career-preview-v001/`에 있다. 실행 중 발견한 테스트 입력 방식 문제와 화면 제거 오류의 이전 실패 기록도 보존했다. Unity 바이너리는 재사용했으며 Unity Editor/Blender 재실행·실물 모바일·타 브라우저·실서비스 백엔드·서버 v003 정산은 미검증이다. `review.json`의 통과 범위만 이번 결과로 인정한다.

새 모델·팔레트·에셋 배치·Unity 프로젝트 등록 없음. 기존 build와 사용 이력을 참조하며 새 build_links를 꾸미지 않는다. Meshy/이미지 생성 호출·소비 크레딧 0. 대화 토큰·실제 작업 노력 시간은 도구에서 측정할 수 없어 null이다. 외부 배포·커밋·푸시·자동 훅·CI·별도 검사 스크립트를 만들지 않았다.
