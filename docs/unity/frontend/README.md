# Career Suite bridge v003

이 디렉터리는 실제 게임 상태를 만드는 코드가 아니라 Unity 이벤트의 수신·보존·전달 어댑터입니다. 기준 규칙은 저장소 AGENTS.md의 v001/v002/v003 절입니다. catalog `schema_version:3`과 런타임 `schemaVersion:1`을 구별합니다. v001 전달본은 보존했습니다.

## 두 출력 연결

Unity 템플릿은 `PROJECT:CareerSuiteTest`, `PROJECT:CareerSuiteIntegration`입니다. 빌드 후 이 디렉터리를 각 출력의 `frontend/`로 복사하고, 출력 루트에 `supported-manifest.json`과 `target-registry.json`을 놓습니다. 전자는 `{build:{build_id},supported:[{buildId,roomId,scenarioId,scenarioVersion,occupationId,sceneId,name,roomName}]}`, 후자는 전체 대상의 `{schema_version:3,targets:[...]}`입니다. 지원 목록은 실제 포함된 고정 조합만 담습니다. 목록에 있다는 사실은 모든 업무 분기의 실행 검수 pass를 의미하지 않습니다.

테스트 화면은 공간 우선 목록, 직업·ID 검색, 같은 공간의 시나리오 선택, 게임 집중 보기, 접힌 이벤트·결과 보기와 JSON 복사·다운로드를 제공합니다. Unity의 `CareerProtocol.ReceiveControl`로 시작·종료하며 테스트 화면이 게임 상태나 완료 결과를 만들지 않습니다. 실제 연동 화면에는 자체 직업 목록이나 개발 로그가 없습니다. 두 화면은 같은 Unity 업무 코드와 `client.js`를 사용합니다.

## 외부 React

`Experience.jsx`를 기존 React 앱에 넣고 `onClient`로 클라이언트를 보관합니다. `onStatus`가 `ready`를 전달한 뒤 아래처럼 호출합니다. 렌더나 StrictMode effect에서 자동 시작하지 않고 사용자의 명시적인 시작 동작에 연결합니다.

```js
const selection=manifest.supported.find(x=>x.buildId===buildId && x.roomId===roomId && x.scenarioId===scenarioId && x.scenarioVersion===scenarioVersion);
if(!selection)throw Error('UNSUPPORTED_COMBINATION');
const started=await client.start(selection,{experienceId:crypto.randomUUID(),requestId:crypto.randomUUID()});
const ended=await client.end({requestId:crypto.randomUUID()});
// 원본 종료 응답을 보존한 뒤 프레임 제거. 타임아웃은 pending_reconciliation.
```

iframe `src`의 `parentOrigin`은 `Experience.jsx`가 정확한 현재 origin으로 설정합니다. 수신은 source/origin/build/room/scenario/version/session/experience를 확인합니다. 동일 요청은 `client.retry(requestId)`로 같은 내용을 재전송합니다. `replay()`는 구현된 Unity Replay 메서드로 보존 이력을 요청합니다. 이벤트 ID 충돌과 sequence 충돌은 `state().conflicts`에 보존합니다. 이전 체험의 늦은 원본은 그 체험에 보존하고 새 실행을 덮지 않습니다. 과정은 범위별 최신 sequence 스냅샷으로 대체하며 누적 횟수를 더하지 않습니다. 종료 `data.events`도 기존 원장에 중복 제거하여 넣습니다. 첫 수신 이전의 session sequence 범위는 알 수 없으므로 `sequenceGaps()`는 실제 관측 이벤트 사이의 간격만 보고합니다.

종료된 experience에서 Unity의 기존 장면 이동 코드가 더 높은 sequence의 pending 이벤트를 잘못 발행하는 경우 원본은 삭제하지 않습니다. `events`와 `postTerminalEvents`에 보존하고 닫힌 최종 스냅샷을 다시 pending으로 바꾸지 않습니다. 실제 종료가 그 pending 이벤트보다 늦게 도착하는 순서 역전에서도 종료 범위의 스냅샷을 복구합니다. 로컬 수신기도 원본 JSONL을 보존하면서 같은 보호를 적용합니다. 이는 Unity 송신부의 기존 종료 뒤 장면 이벤트 문제를 구현 완료로 숨기는 처리가 아니며, 해당 원본은 조사 대상으로 남습니다.

## 저장 ACK와 미수신 정산

`createOutbox`는 전송 대기 원본 JSON을 고정하여 브라우저에 보존하고 전송 실패를 pending으로 유지합니다. 같은 sessionId/eventId와 `stored:true`가 있는 ACK만 저장 완료로 표시합니다. ACK 이후 브라우저 영속 저장에는 가벼운 ACK 참조만 남기고 원본은 현재 클라이언트 원장과 수신 서버에 보존합니다. 재로딩 뒤 ACK 참조의 이벤트를 다시 받으면 원본을 서버로 재전송해 중복·내용 충돌을 대조합니다. Unity 발행, React 수신, 백엔드 저장 ACK는 별도 상태입니다. localStorage 보존 오류는 `persistenceError`로 노출합니다. 재접속의 전체 내구성·백엔드 보존 정책은 외부 서비스 계약에 따릅니다.

`backend.js`의 실제 endpoint·인증 헤더 공급 함수를 서비스가 전달해야 합니다. 비밀키를 WebGL에 넣지 않습니다. 기본 credentials는 include이며 서버의 인증·CSRF·CORS 계약을 적용합니다. 서버가 소유자와 lease를 검증하고 명시적 새 시작 + 만료 + 원자적 fence로 정산합니다. 클라이언트 타이머나 숨겨진 탭만으로 중단을 확정하지 않습니다. `createResolutionTracker`는 인증된 API 응답에만 사용하고 window message를 넣지 않습니다. resolutionId/revision 이력과 늦은 Unity 종료 우선 표시를 구별합니다. 새 플레이 승인과 lease 발급·갱신·무효 탭 쓰기 차단은 실제 서버 구현이 필요합니다. 어댑터가 서버 정산을 대신 구현했다고 간주하지 않습니다.

`react-example.jsx`는 끝까지 연결해야 하는 서버 승인 지점을 명시합니다. 미연결 상태에서 새 실행을 조용히 허용하지 않습니다. 백엔드 v003 수용 사례·JSON Schema는 `docs/machine/contracts/career-experience/v003/`를 사용합니다.

## 로컬 수신기

이 디렉터리의 `server.mjs`는 HTTP 정적 서버와 fsync JSONL 원본 수신기입니다. 실서비스 인증·lease·정산 서버가 아닙니다.

```powershell
node frontend/server.mjs --root .
```

기본 주소는 http://127.0.0.1:8194/ 입니다. 실행 폴더는 실제 출력 또는 압축을 푼 루트이며 필요하면 `--root`에 지정합니다. `/__local/events`는 중복 제거·동일 ID 충돌 거부·범위별 최신 스냅샷 저장을 합니다. 결과는 `local-receiver-data/`에 생깁니다. 테스트 UI의 로컬 ACK를 실서비스 저장 성공으로 보고하지 않습니다.

## 실제 확인 범위

`docs/machine/evidence/career-suite-bridge-v002/adapter-execution.json`은 Node에서 모의 Unity 전송으로 수행한 어댑터 실행 증거입니다. 실제 Unity/HTTP/React/백엔드 왕복은 해당 빌드의 별도 실행 기록을 확인해야 합니다. 이 문서만으로 실행 상태를 승격하지 않습니다. 필요한 외부 정보는 실제 API URL, 인증·CSRF/CORS, ACK 형식, 소유권 lease/fence/admission 계약, 원본 재조회·보존 정책입니다.


## v003 효과음과 화면 배경

기존 v002 전달본은 보존합니다. audio.js와 audio-ui.js는 두 WebGL 템플릿에서 공통으로 설치됩니다. web/career-audio/v002/ 전체를 출력의 audio/에 복사합니다. 각 MP3 경로는 audio/audio-manifest.json 기준입니다. 현재 사용 가능한 파일만 재생하며 미준비 항목은 대체 소리로 채우지 않습니다. 테스트 화면에는 준비된 파일의 미리듣기와 미준비 항목 목록이 있습니다. 외부 연동 화면에는 음량·음소거 설정만 표시합니다.

실제 브라우저의 게임 화면 안에서 클릭 또는 키 입력이 있어야 오디오 잠금이 해제됩니다. 부모 React 시작 클릭은 자식 iframe의 재생 허용을 보장하지 않으므로 자식에 활성화 버튼을 제공합니다. 음소거와 음량은 같은 origin의 localStorage에 보존합니다. 로딩 전에 온 소리와 잠금 중 소리는 나중에 몰아서 재생하지 않습니다.

배경 설정은 Experience의 backgroundColor prop 또는 client.setPresentation({backgroundColor:'#203B43'})로 합니다. 준비 전 값은 ready 후 전달합니다. RGB 6자리만 허용하며 CareerProtocol.SetPresentation으로 전달됩니다. 업무 요청·이벤트·과정 지표와 분리하며 React 배경 prop 변경은 iframe을 다시 만들거나 체험을 시작하지 않습니다. 값을 생략하면 기존 Unity 배경입니다. 예제 URL은 backgroundColor=%23203B43을 지원합니다. 상세 효과음 API와 검수 한계는 docs/human/integrations/career-audio-v001.md에 있습니다.
