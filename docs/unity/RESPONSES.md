# 응답 형식 — Unity → React

| 응답 | 시점·예시 |
|---|---|
| experience.started | 방·선택 시나리오 준비 완료. 03-started-response.json |
| experience.ended | 종료 확정. completed/aborted/failed 모두 같은 응답 type |
| experience.error | 명령/라우팅 오류. 업무 실수·최종 업무 실패와 별도 |

## 종료 결과 예시

- `04-completed-response.json`: 필수 보관·인계까지 완료한 뒤 종료. outcome completed, success true.
- `05-aborted-response.json`: 출력 도중 사용자가 종료. outcome aborted, success false, completionCode USER_ABORTED, context.termination에 마지막 단계와 남은 업무.
- `06-failed-response.json`: 시나리오 명세의 최종 실패 조건 충족. outcome failed. 출력 설정 한 번 틀린 것만으로 시나리오 최종 실패를 만들지 않습니다.
- `07-partial-data-response.json`: 종료는 확인했으나 일부 기록이 누락됨. 카운트 null, 평가 unavailable/null. 미측정을 0회 실수로 해석하지 않습니다.
- `08-control-error-response.json`: 잘못된 roomId 요청. 정상 종료 봉투보다 작은 제어 오류 형식이며 eventId/result/context를 가정하지 않습니다.

## 프론트가 읽을 부분

- requestId: 어떤 호출의 응답인지. roomId/experienceId/sessionId: 어떤 방·실행인지.
- process: 현재 scenarioRunId의 누적 시도·정상 복귀·업무상 되돌아감·재시도·실수·반복 실수·도움·활성 시간.
- result: 실제 완료/중단/최종 실패와 작업별 결과. 중단해도 이미 완료한 결과는 partialResults로 유지.
- context: 평가 코드·근거·해석·중단 시점과 남은 업무.
- data.events: 선택적으로 함께 전달하는 원본 이력. eventsComplete false면 전체 이력이라고 간주하지 않습니다. 예시 파일은 원본 이력이 없는 가상 요약이며 조회 API는 아직 구현되지 않았습니다.
- data.previousRuns: 같은 experience에서 초기화한 이전 run 요약을 분리하는 선택 확장. 현재 run 카운트에 합산하지 않습니다.

## 평가 코드와 의미

평가 가능한 terminal 결과에서 우선순위는 TASK_INCOMPLETE → TASK_REPEATED_ERRORS → TASK_GUIDED_COMPLETED → TASK_SELF_CORRECTED → TASK_SMOOTH입니다. 상세 결정 조건과 카운트 정의는 PROTOCOL-SNAPSHOT.md에 있습니다. 이는 이번 가상 업무의 수행 설명이며 개인의 적성·능력 점수가 아닙니다.

팝업 닫기·Esc·일시정지·초점 상실은 체험 종료가 아닙니다. 명시적 도중 종료 자체도 실수에 더하지 않습니다. 강제 탭 종료·통신 단절은 마지막 응답이 보장되지 않으므로 사용자 포기로 단정하지 않습니다.
