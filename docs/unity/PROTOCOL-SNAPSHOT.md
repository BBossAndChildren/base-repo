# 공통 규격 출처 스냅샷

원본: Unity-MeshyAI/AGENTS.md. 생성 시각: 2026-10-31T05:15:35.126087+09:00
원본 SHA-256: d7e21a113fff0ca4575a7d5f4e8498348178e176a0679102351917693d28755c

이 파일은 전달용 고정 스냅샷입니다. 규칙을 여기서 독립 변경하지 말고 원본 AGENTS.md를 수정한 뒤 새 패키지 버전으로 재발행합니다. 통신 구현·실행 검증 완료를 뜻하지 않습니다.

### Unity ↔ React 공통 응답·과정·결과·해석 컨텍스트 규격 v001

#### 적용 범위와 구현 상태

- 앞으로 새로 작성하거나 수정하는 모든 직업체험 시나리오와 Unity/WebGL 구현은 이 공통 규격을 적용한다. 통합 빌드·여러 장면·여러 물건도 같은 이벤트 이름과 봉투 형식을 사용하고 작업별 차이는 `data`에 둔다. 규칙의 기준은 이 AGENTS.md이며 별도 규칙 폴더·자동 훅·검사 스크립트를 만들지 않는다.
- 규격 정의, Unity 송신 구현, React 수신 구현, 실제 통합 실행 검증은 서로 다른 상태다. 기존 빌드에 소급하여 연동 완료를 표시하거나, `window.officeState` 같은 진단 스냅샷을 공통 결과 이벤트 구현으로 간주하지 않는다. 이번 지침 추가 자체는 기존 게임·빌드·catalog의 구현/실행 상태를 변경하지 않는다.
- 런타임 이벤트는 UTF-8 JSON과 아래 camelCase 필드를 사용한다. `schemaVersion:1`은 **통신 봉투의 버전**이며 catalog의 `schema_version:3`을 대체하지 않는다. 이벤트를 저장소 JSON 파일로 보존할 때에는 `{ "schema_version": 3, "protocol": "career-experience", "protocolVersion": "v001", "events": [] }` 봉투 안에 원본 이벤트를 넣는다. 버전 불일치는 명시적으로 처리하고 누락 필드를 추정으로 채우지 않는다.

#### 프론트 방별 호출·체험 종료 응답 프로필

- 프론트의 기본 연동은 `start_experience`로 방별 체험을 시작하고 `end_experience`를 호출하면 `experience.ended`로 그동안의 과정·결과·해석 컨텍스트를 묶어 받는 방식이다. 개별 행동 이벤트는 Unity 내부 원장에 보존하며 프론트가 실시간으로 모든 행동을 구독해야만 종료 응답을 받을 수 있게 만들지 않는다. 실시간 이벤트 전달은 선택 기능이다.
- 호출 JSON의 공통 필수 필드는 `schemaVersion:1`, `protocol:career-experience`, `requestId`, `action`, `sessionId`, `experienceId`, `roomId`다. 시작 호출에는 `scenarioId`, `scenarioVersion`, 종료 호출에는 `reason:USER_REQUESTED_END`를 추가한다. reason은 사용자의 종료 요청 의도이며 완료/중단 판정을 프론트가 강제로 지정하는 값이 아니다.
- `roomId`는 프론트가 구별하는 논리 방 ID이며 기존 sceneId와의 고정 매핑을 명세한다. 한 방에 여러 시나리오가 있으면 시작 요청의 scenarioId/version으로 선택하며 임의로 첫 시나리오를 실행하지 않는다. 알 수 없는 방·시나리오 또는 실제 실행과 다른 roomId/experienceId의 요청은 명시적인 제어 오류로 처리하고 다른 체험에 적용하지 않는다.
- `experienceId`는 방을 새로 열어 체험을 시작할 때마다 프론트가 생성하는 고유 실행 묶음 ID다. sessionId는 통합 플레이 동안 유지한다. 같은 방을 다시 시작하면 새 experienceId를 사용한다. 내부 전체 초기화는 같은 experienceId 안에서 새 scenarioRunId로 구별하며 이전 run 이력을 보존한다.
- 프론트 프로필의 응답은 기존 공통 이벤트 봉투에 `roomId`, `experienceId`, `requestId`를 필수로 추가한다. 응답의 requestId는 처리한 호출의 ID이며 시작 준비가 끝났을 때 `experience.started`, 종료 처리가 확정됐을 때 `experience.ended`로 응답한다. 내부 자동 행동 이벤트에서 직접 대응하는 호출이 없으면 requestId null을 허용한다. 기존 내부 이벤트 예시는 이 추가 프로필 없이도 유효하다.
- `experience.ended`의 type은 정상 완료·중도 종료·최종 실패 모두 동일하다. 실제 업무 완료 조건에 따라 result.outcome을 completed/aborted/failed로 결정하며, 종료 버튼을 눌렀다는 이유만으로 이미 완료한 업무를 aborted로 바꾸지 않는다. 중도 종료의 partialResults와 context.termination은 아래 기준을 그대로 따른다. 시작/제어 오류 응답은 `experience.error`로 구별하며 오류를 업무 실수나 완료 결과로 집계하지 않는다. 제어 오류 봉투는 schemaVersion/protocol/requestId/sessionId/experienceId/roomId/type 및 `error:{code,message}`를 사용한다.
- 하나의 experience는 선택한 시나리오의 현재 run 종료 요약을 기본 process/result/context로 반환한다. 같은 experience에서 초기화한 과거 run은 선택 확장 `data.previousRuns`에 분리해 보존하며 최종 run과 횟수를 합산하지 않는다. 해당 범위의 근거 원본 이벤트를 부모 응답 자신을 제외한 `data.events` 배열로 함께 전달할 수 있다. events는 시간순 원장의 조회 결과이며 새 행동으로 다시 집계하지 않는다. 전량 전달 여부는 `data.eventsComplete`로 명시하고, 근거 이벤트가 생략되면 실제 구현한 보존/조회 경로를 전달 문서에 적는다. 종료 응답만 있어도 카운트·결과·해석은 읽을 수 있어야 한다.
- 같은 requestId의 전달 재시도는 같은 응답과 eventId로 처리한다. 종료 확정은 experienceId당 한 번이며 새 requestId로 이미 끝난 experience를 다시 종료하려 하면 `ALREADY_ENDED` 제어 오류와 원본 종료 eventId를 안내하고 새 업무 결과·카운트를 만들지 않는다. React는 roomId/experienceId/requestId를 확인해 해당 호출에 연결하고 eventId로 중복을 제거한다. 종료 응답을 수신·보존한 다음 Unity 화면을 제거한다. 수신 전 제거·타임아웃·강제 종료는 정상 응답을 받은 것처럼 꾸미지 않는다.
- 프론트 전달 ZIP은 실행 WebGL ZIP과 구별한 명세·타입·가상 예시 패키지로 만들 수 있다. 규칙의 원본은 이 AGENTS.md이며 전달 문서는 해당 절에서 생성한 버전 고정 스냅샷임을 명시한다. 기준 출처와 해시·미구현 상태를 남기고 독립 규칙 원장으로 수정하지 않는다. 스냅샷을 갱신할 때 새 패키지 버전을 사용한다. 명세 전달만으로 Unity 브리지·React 연동·종료 결과 수신의 실행 pass를 등록하지 않는다.

#### 공통 이벤트 봉투

아래 필드는 모든 이벤트에서 유지한다. null은 해당 없음 또는 명시된 미측정에만 사용하며 해당 사유를 남긴다.

| 필드 | 계약 |
|---|---|
| `schemaVersion`, `protocol` | 각각 `1`, `career-experience`로 고정한다. |
| `eventId`, `sequence`, `occurredAt` | 이벤트 고유 ID, session 내 1부터 증가하는 정수 순번, 시간대가 포함된 ISO 8601 발생 시각. 재전송 시 세 값과 내용이 바뀌지 않는다. |
| `sessionId`, `scenarioRunId` | 통합 플레이 세션 ID와 시나리오 한 번의 실행 ID. 장면 전환·팝업 닫기는 session을 초기화하지 않는다. 전체 재시작은 새 scenarioRunId로 시작하고 이전 기록을 보존한다. |
| `buildId`, `sceneId`, `scenarioId`, `scenarioVersion` | 실제 빌드 ID, 명세에 고정한 논리 장면 ID, 시나리오 ID·고정 버전. 에셋 ID를 장면 ID로 사용하지 않는다. |
| `objectId`, `instanceId`, `assetId`, `assetVersion` | 논리 물건 ID, 실제 장면 인스턴스 식별자, 실제 에셋 ID·버전. 같은 에셋의 반복 배치를 구별한다. 물건에 귀속되지 않는 장면/시나리오 이벤트에서는 네 값 모두 null을 허용한다. |
| `stepId`, `workItemId`, `attemptId` | 업무 단계 ID, 처리할 문서/부품 등 작업 항목 ID, 실제 제출 시도 ID. 해당 없는 선택·장면 이벤트는 null을 허용한다. 새 제출은 새 attemptId이며 전달 재시도는 같은 ID다. |
| `requestRevision`, `documentRevision` | 해당 시나리오의 실제 요청·문서 revision. 사용하지 않는 시나리오는 null이며 임의의 1로 채우지 않는다. 요청 변경을 새 플레이나 실수로 취급하지 않는다. |
| `type`, `action` | 아래 공통 이벤트 종류와 시나리오에 정의한 고정 행동 코드(예: `print`). UI 표시 문장을 코드 ID로 쓰지 않는다. |
| `process`, `result`, `context`, `data` | 각각 아래 공통 구조와 작업별 입력·변경·결과 상세 객체. 아직 발생하지 않은 결과를 성공으로 채우지 않는다. |

최소 공통 이벤트 종류:

- 생명주기: `scene.entered`, `scene.exited`, `scenario.started`, `scenario.paused`, `scenario.resumed`, `scenario.reset`, `scenario.completed`, `scenario.failed`, `scenario.aborted`.
- 물건·화면: `object.selected`, `interaction.opened`, `interaction.closed`, `navigation.back`.
- 업무 과정: `interaction.started`, `interaction.progress`, `interaction.validation_failed`, `interaction.retry_requested`, `workflow.backtracked`, `request.changed`, `guidance.requested`, `guidance.presented`.
- 작업 결과: `interaction.completed`, `interaction.failed`, `interaction.aborted`.

`interaction.failed`는 한 작업 시도의 실패이며 전체 시나리오 실패를 자동 의미하지 않는다. `interaction.progress`는 상태 스냅샷·진행률 용도이며 프레임마다 같은 이벤트를 새 행동처럼 만들지 않는다. 성공 결과는 실제 업무 완료 전이가 확정된 때 한 번 발행한다. 비동기 출력의 시작을 출력 완료로 보고하지 않는다. 인계가 완료 조건이면 출력·보관만으로 `scenario.completed`를 발행하지 않는다.

#### 과정 기록과 카운트

- 과정의 원장은 고유 이벤트 이력이다. 누적 횟수는 이 이력에서 도출한 조회용 요약이며 React와 Unity가 각각 별도로 증가시키지 않는다. Unity의 실제 상태·판정 확정 지점에서 하나의 공통 모듈이 발행하고 집계한다. React는 이를 수신·표시·저장한다.
- `process.scope`는 `interaction` 또는 `scenario`다. interaction 요약은 현재 scenarioRunId의 해당 stepId·objectId·workItemId, scenario 요약은 현재 scenarioRunId 전체를 집계한다. 요청 revision은 각 원본 이벤트에 보존하며 요청 변경만으로 기존 실행 기록·누적 횟수를 지우지 않는다. 서로 다른 범위의 요약을 더해 중복 합산하지 않는다.
- `measurementStatus`는 `complete`, `partial`, `unavailable`이다. 신뢰할 수 없는 횟수·시간은 null과 `measurementNote` 사유로 표시하며 미측정을 0으로 쓰지 않는다. `complete`의 횟수·활성 시간은 측정된 0 이상의 정수이고 guidanceUsed는 boolean이다. 미측정 guidanceUsed도 false가 아닌 null로 표시한다. measurementNote는 complete이면 null, partial/unavailable이면 구체적 사유 문자열이다. 공통 필드는 `attemptCount`, `navigationBackCount`, `backtrackCount`, `retryCount`, `mistakeCount`, `repeatedMistakeCount`, `helpRequestCount`, `guidanceUsed`, `elapsedActiveMs`다.
- `attemptCount`: 실제 업무 판정에 제출한 시도 수. 입력 글자 수정·마우스 이동·카메라 회전·팝업 열기를 제출로 세지 않는다. 동일 비동기 작업 중 잠긴 반복 입력은 새 attempt가 아니다.
- `navigationBackCount`: 사용자가 팝업 닫기·사무실 복귀 등 명시적인 뒤로가기를 실행한 횟수. 이는 UI 사용 기록이며 그 자체로 실수나 업무상 되돌아감이 아니다.
- `backtrackCount`: 이미 진행한 업무 단계에서 이전 업무 단계로 사용자가 실제 돌아가 재확인·수정한 횟수. `workflow.backtracked`의 `data`에 `fromStepId`, `toStepId`, `reasonCode`를 기록한다. 자발적인 재확인도 업무상 되돌아감에는 포함할 수 있지만 실수로 자동 판정하지 않는다. 정상적인 연결 업무·팝업 복귀·시스템의 필수 재확인·변경 요청 대응은 이 카운트에서 제외한다.
- `retryCount`: 실패하거나 중단된 동일 업무 시도 이후 새 attemptId로 실제 다시 제출한 횟수. `interaction.retry_requested` 버튼만 누르고 제출하지 않은 경우는 의도만 기록하고 횟수를 증가시키지 않는다. 새 작업 항목·새 요청 조건에 대한 첫 제출은 재시도가 아니다. 개별 시도의 재시작과 전체 시나리오 초기화를 구별한다.
- `mistakeCount`: 시나리오에 미리 정의한 업무 판정에서 플레이어 입력이 실제 조건을 위반한 고유 failureId 수. `data`에 `failureId`, `reasonCodes`, `faultSource`(`player`/`system`/`none`), `expected`, `actual`을 기록한다. 입력 1회가 여러 조건을 위반해도 failureId 1개로 세고, `validation_failed`와 `failed`가 같은 failureId를 가리키면 한 번만 센다. reasonCode는 고정 시나리오 사전의 코드(예: `COPY_COUNT_MISMATCH`, `DATE_MISMATCH`, `WRONG_CLASSIFICATION`, `SEQUENCE_VIOLATION`)를 사용한다.
- `repeatedMistakeCount`: 같은 scenarioRunId 안에서 `stepId + objectId + workItemId + requestRevision + reasonCode` 조합이 이미 실수로 기록된 뒤 다시 발생한 추가 failureId 수. 같은 실수가 3회면 mistakeCount 3, repeatedMistakeCount 2다. 하나의 failureId에 여러 코드가 있어도 반복 카운트는 최대 1 증가한다. 첫 발생부터 반복 횟수에 포함하지 않는다.
- `helpRequestCount`는 사용자의 명시적 도움 요청 수다. `guidanceUsed`는 선택적 힌트·단계별 정답 안내를 실제로 제시한 경우 true이며 단순 요청만으로 true로 만들지 않는다. 오류 이후 자동으로 제시한 추가 안내도 포함하되, 기본 조작법·일반 오류 설명·필수 동료 대화와 확인 질문은 포함하지 않는다. `guidance.presented`에 `data.isAssistance`와 `reasonCode`를 명시한다.
- `elapsedActiveMs`는 로딩·일시정지를 제외한 해당 범위의 활성 시간이다. 오래 걸림·되돌아감·추가 확인만으로 실수를 만들지 않는다. 중복 전송·출력 잠금 반복 클릭·브라우저/통신 오류·게임 자체 오류는 플레이어 실수에서 제외하고 원인 코드와 별도로 보존한다. 배경 물건 클릭도 명세의 업무 위반 판정이 없으면 실수로 세지 않는다.
- 요청 변경으로 돌아가는 경우 `REQUEST_CHANGED` 또는 `EXPECTED_RECONFIRMATION` 등 고정 원인을 남긴다. 시스템이 요구한 재확인은 backtrack/mistake 증가 없이 기록한다. 명세에 원인이 없거나 확인할 수 없으면 알 수 없음으로 기록하며 추측으로 실수 원인을 붙이지 않는다.

#### 결과와 해석 컨텍스트

- `result`의 필수 필드는 `outcome`(`pending`/`completed`/`failed`/`aborted`), `success`(true/false/null), `completionCode`(고정 코드 또는 null), `data`(작업별 최종 결과 객체)다. 진행 중에는 pending/null/null/{}을 사용한다. completed는 모든 해당 범위 완료 조건을 충족한 경우 true, failed/aborted는 false다. 시나리오의 인계 등 필수 조건 누락을 작업 한 건의 성공으로 덮지 않는다.
- 공통 집계와 판정은 시나리오·범위가 다르면 분리한다. 예를 들어 출력 interaction 완료 평가와 보관·인계까지의 scenario 완료 평가는 별도 이벤트이며 서로 덮어쓰지 않는다. 실패한 개별 제출의 결과·원인도 최종 성공 후 삭제하지 않는다.
- `context`의 필수 필드는 `assessmentStatus`(`pending`/`evaluated`/`unavailable`), `assessmentCode`(아래 고정 코드 또는 null), `ruleVersion`(`v001`), `reasonCodes`(중복 없는 고정 코드 배열), `evidenceEventIds`(근거 원본 eventId 배열), `interpretation`(문자열 또는 null), `limitations`(한계·미측정 사유 배열)이다. 진행 중에는 assessmentStatus pending, assessmentCode/interpretation null이다.
- 수집 누락·미측정·근거 부족으로 같은 입력에서 판정을 재현할 수 없으면 unavailable/null로 남긴다. 이때 불완전한 기록을 실수 없음·실패·`TASK_INCOMPLETE`로 임의 변환하지 않는다. 평가 가능한 terminal 결과에서만 아래 순서를 위에서 아래로 적용해 **하나의 주 평가 코드**를 정한다. 선택된 코드에 가려진 완료·실수·반복·도움 사실은 process/result와 reasonCodes에 그대로 남긴다.

| 판정 순서 | assessmentCode | 결정 조건·의미 |
|---|---|---|
| 1 | `TASK_INCOMPLETE` | 해당 범위의 최종 outcome이 failed 또는 aborted. 미완료·실패·중단 이유를 completionCode/reasonCodes로 구별한다. 사용자 도중 종료는 `USER_ABORTED` 컨텍스트를 함께 남기며 종료 자체를 실수로 세지 않는다. |
| 2 | `TASK_REPEATED_ERRORS` | 최종 completed이고 repeatedMistakeCount가 1 이상. 반복 오류 뒤 완료했다는 사실과 도움 여부를 함께 남긴다. |
| 3 | `TASK_GUIDED_COMPLETED` | 최종 completed, 반복 오류 없음, guidanceUsed true. 선택적 안내를 받아 완료. |
| 4 | `TASK_SELF_CORRECTED` | 최종 completed, 반복 오류 없음, guidanceUsed false, mistakeCount가 1 이상. 기록된 실수를 스스로 수정해 완료. |
| 5 | `TASK_SMOOTH` | 최종 completed, mistakeCount 0, guidanceUsed false. 기록된 실수 없이 완료. 재확인·정상 복귀가 0이었다는 뜻은 아니다. |

- 이 코드들은 이번 가상 업무 수행의 설명용 범주이며 숫자 서열·직업 적성·지능·개인의 전반적 능력 점수가 아니다. 직업마다 임의의 기준으로 같은 코드의 의미를 바꾸지 않는다. 정책·코드 의미·집계 기준을 바꾸면 ruleVersion을 올리고 이전 결과의 버전·원본 이력을 보존한다.
- 해석은 관찰 사실과 근거에서만 만든다. 예: “부수 오류 1회 후 요청을 재확인하고 수정하여 출력 완료.” 횟수만으로 “실제 업무 능력이 낮음”, “이 직업에 부적합함”을 결론내리지 않는다. 추가 설명·추론이 있으면 한계와 근거를 표시하고 관찰 데이터를 덮어쓰지 않는다.

#### 도중 종료·하다가 중단한 경우의 컨텍스트

- 사용자가 명시적으로 ‘작업 그만하기/체험 종료’를 확정하여 미완료 작업을 끝내면 `interaction.aborted`, 전체 시나리오를 끝내면 `scenario.aborted`를 발행한다. 전체 종료 시 진행 중인 개별 작업도 종료한다면 두 이벤트의 범위를 구별하고 같은 terminationId로 연결한다. 두 이벤트를 사용자 종료 2회 또는 실수 2회로 세지 않는다. 팝업 닫기·Esc로 사무실 복귀·일시정지·잠깐 다른 탭 보기·초점 상실은 종료로 처리하지 않는다.
- 실제 업무 행동이 시작된 뒤 사용자가 종료했다는 근거가 있으면 `result.outcome:aborted`, `success:false`, `completionCode:USER_ABORTED`와 `context.reasonCodes`의 `USER_ABORTED`를 사용한다. 이는 “중간에 하다가 그만둠”이라는 완료 상태 컨텍스트이며 업무 오답 판정이 아니다. 작업 시작 전 종료는 `USER_EXITED_BEFORE_START`로 구별한다. 이 추가 정보는 기존 평가 코드의 의미를 바꾸지 않는 선택 확장이므로 schemaVersion 1/ruleVersion v001을 유지한다.
- `context.termination`은 종료된 범위에서 필수이며 그 외에는 null 또는 생략을 허용한다. 내부 필수 필드는 `terminationId`, `code`, `initiatedBy`(`user`/`system`/`unknown`), `workStarted`(boolean 또는 미측정 null), `lastStepId`, `lastObjectId`, `lastState`, `completedStepIds`, `remainingStepIds`, `inFlightActionIds`다. 마지막 단계·물건·상태는 실제 마지막 유효 기록으로 채우고 없거나 알 수 없으면 null로 표시한다. 단계/비동기 작업 배열도 알 수 없으면 []가 아닌 null과 limitations의 사유를 사용한다. 사용자에게 이유를 직접 받은 경우에만 선택 필드 `userProvidedReason`에 보존하고 흥미 저하·능력 부족 등의 이유를 추측하지 않는다.
- 종료 응답의 `process`는 종료 직전까지의 실제 누적 기록을 유지하고 `result.data.partialResults`에 이미 완료한 결과만 보존한다. 미출력·미보관·미인계 결과를 완료로 채우지 않는다. 시간·횟수·이전 실수는 초기화하지 않으며 종료 동작 자체로 mistakeCount/repeatedMistakeCount/retryCount를 증가시키지 않는다. 평가 근거가 충분하면 assessmentCode는 `TASK_INCOMPLETE`, 해석은 “문서 수정·저장 후 출력 도중 사용자 종료. 출력·보관·인계는 미완료”처럼 완료한 범위와 남은 범위를 구별한다. 근거가 불완전하면 assessmentStatus unavailable/assessmentCode null을 유지하면서 확인된 종료 사실과 한계만 제공한다.
- 의도적인 종료·초기화가 확정되면 진행 중 비동기 작업의 취소/분리 정책을 적용하고 닫힌 범위의 늦은 완료 콜백이 새 실행에 반영되거나 aborted를 completed로 덮어쓰지 않게 한다. 완료가 먼저 확정된 작업의 completed 결과는 이후 전체 시나리오 종료로 aborted로 바꾸지 않는다. 초기화로 중단한 경우에는 `USER_RESET` 원인을 구별하고 기존 run을 보존한 뒤 새 run을 시작한다.
- React의 명시적 화면 종료·Unity 제거는 가능한 경우 Unity에 종료를 요청하고 종료 요약을 수신·보존한 다음 수행한다. 브라우저 탭 닫기·강제 종료·통신 단절에서는 마지막 이벤트 전달이 보장되지 않으므로 종료 전 상태를 주기적으로 보존하고 재접속 시 대조한다. 마지막 기록만 있고 사용자 종료 확정 근거가 없으면 `SESSION_INTERRUPTED`/initiatedBy unknown과 측정 한계를 남긴다. 미관측 중단을 사용자 포기로 확정하거나 정상 일시정지를 임의의 시간 초과로 사용자 종료에 바꾸지 않는다. 이력 보완·전달 재시도도 eventId/terminationId로 중복을 제거한다.

복붙용 **도중 종료 부분 양식**은 아래와 같다. 가상 예시이며 기존 공통 봉투의 ID·시각·sequence·process 등 나머지 필드를 유지한 채 병합한다. 정상 완료 예시와 동시에 한 이벤트의 결과로 적용하지 않는다.

```json
{
  "type": "scenario.aborted",
  "action": "quit_scenario",
  "result": {
    "outcome": "aborted",
    "success": false,
    "completionCode": "USER_ABORTED",
    "data": {
      "partialResults": {
        "documentSaved": true,
        "printedCopies": 0,
        "handoffConfirmed": false
      }
    }
  },
  "context": {
    "assessmentStatus": "evaluated",
    "assessmentCode": "TASK_INCOMPLETE",
    "ruleVersion": "v001",
    "reasonCodes": ["USER_ABORTED"],
    "evidenceEventIds": ["evt-work-started", "evt-quit-confirmed"],
    "interpretation": "문서 수정·저장 후 출력 도중 사용자가 종료함. 출력·보관·인계는 미완료",
    "limitations": ["종료 자체는 업무 실수나 적성 판단 근거가 아님"],
    "termination": {
      "terminationId": "termination-example-001",
      "code": "USER_ABORTED",
      "initiatedBy": "user",
      "workStarted": true,
      "lastStepId": "print",
      "lastObjectId": "copier",
      "lastState": "printing",
      "completedStepIds": ["confirm", "review"],
      "remainingStepIds": ["print", "file"],
      "inFlightActionIds": ["print-job-example-001"]
    }
  }
}
```

#### 장면 공통 전달·보존

- 공통 통신 모듈은 장면 전환 중에도 유지하고 세션·실행 ID와 이력을 장면마다 새로 초기화하지 않는다. 완료 이벤트는 상태 확정 후 발행하고 동일 완료 전이의 재클릭은 추가 완료·출력·실수를 만들지 않는다.
- Unity → 같은 페이지의 React 전달 이름은 `career-experience:event`로 고정하고 이벤트 detail에 공통 JSON 객체를 넣는다. 렌더링 라이브러리별 코드는 이 규격으로 연결하는 어댑터에만 둔다. iframe이면 `{ "channel": "career-experience", "event": <공통 이벤트> }` 형태로 부모에 전달한다. 송신 targetOrigin을 명시하고 수신 origin·source·버전·ID를 확인한다.
- 전송 재시도는 같은 eventId를 사용하고 수신 측은 중복을 제거한다. 순서가 바뀌면 sequence로 복원하며, 누락 감지 시 원본 이벤트 재전달/조회로 복구한다. 숫자 간격을 추정 이벤트로 채우지 않는다. 리스너가 늦게 연결되거나 장면이 바뀌어도 상태 전이·오류·terminal 이벤트를 잃지 않도록 준비 신호, 보존 이력과 재전달 방식을 구현·전달 문서에 명시한다. 여러 전달 경로를 동시에 듣는 경우에도 같은 eventId를 한 번만 처리한다.
- `scenario.reset`은 초기화 직전의 이전 scenarioRunId와 최종 과정 요약을 보존한다. 미완료 실행은 해당 사용자의 중단/초기화 원인을 기록하고 scenario.aborted로 종료한 뒤 새 scenarioRunId의 scenario.started를 발행한다. 이미 완료된 실행은 completed를 aborted로 바꾸지 않는다. 새 실행의 카운트만 0부터 시작하며 과거 실행과 합산하지 않는다.
- 시나리오 명세에 단계·행동 코드, 물건/실제 인스턴스/에셋 연결, 작업 항목, 이벤트 발생 지점, reasonCode 사전, 정상 복귀·되돌아감·재시도·실수·도움 판정 기준, 작업별 result.data 구조, revision 변경·초기화 규칙을 구체화한다. 전달 문서에는 실제 지원 규격 버전·이벤트와 React 수신 예시·해당 빌드에서 검증한 범위를 적는다. 지침 양식을 실제 측정 결과로 catalog에 등록하지 않는다.

#### 복붙용 공통 응답 예시

아래는 **가상의 시나리오 범위 완료 요약**이다. 물건 이벤트에서는 objectId/instanceId/assetId/assetVersion/stepId/workItemId/attemptId를 해당 실제 값으로 채운다. 아래 evidenceEventIds가 가리키는 원본 과정 이벤트도 함께 보존해야 하며, 이 예시만으로 실제 실행 근거를 만들지 않는다.

```json
{
  "schemaVersion": 1,
  "protocol": "career-experience",
  "eventId": "evt-020",
  "sequence": 20,
  "occurredAt": "2026-10-31T10:30:00+09:00",
  "sessionId": "session-example-001",
  "scenarioRunId": "run-example-001",
  "buildId": "example-v001",
  "sceneId": "office",
  "scenarioId": "career-net-253-office-documents",
  "scenarioVersion": "v001",
  "objectId": null,
  "instanceId": null,
  "assetId": null,
  "assetVersion": null,
  "stepId": null,
  "workItemId": null,
  "attemptId": null,
  "requestRevision": 1,
  "documentRevision": 2,
  "type": "scenario.completed",
  "action": "complete_scenario",
  "process": {
    "scope": "scenario",
    "measurementStatus": "complete",
    "measurementNote": null,
    "attemptCount": 6,
    "navigationBackCount": 3,
    "backtrackCount": 1,
    "retryCount": 1,
    "mistakeCount": 1,
    "repeatedMistakeCount": 0,
    "helpRequestCount": 0,
    "guidanceUsed": false,
    "elapsedActiveMs": 95000
  },
  "result": {
    "outcome": "completed",
    "success": true,
    "completionCode": "OFFICE_DOCUMENTS_HANDED_OFF",
    "data": {
      "documentId": "DOC-001",
      "copies": 2,
      "folder": "회의자료",
      "handoffConfirmed": true
    }
  },
  "context": {
    "assessmentStatus": "evaluated",
    "assessmentCode": "TASK_SELF_CORRECTED",
    "ruleVersion": "v001",
    "reasonCodes": ["COPY_COUNT_MISMATCH", "USER_RECHECK"],
    "evidenceEventIds": ["evt-012", "evt-013", "evt-019"],
    "interpretation": "부수 오류 1회 후 요청을 재확인하고 수정하여 출력·보관·인계를 완료함",
    "limitations": ["가상 체험 한 회의 수행 기록이며 직업 적성·전반적 능력 진단이 아님"]
  },
  "data": {}
}
```

