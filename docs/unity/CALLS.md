# 호출 형식 — React → Unity

시작 호출은 `examples/01-start-experience.json`, 종료 호출은 `examples/02-end-experience.json`을 그대로 복사해 실제 ID로 바꾸세요.

| 필드 | 의미 |
|---|---|
| schemaVersion / protocol | 1 / career-experience 고정 |
| requestId | 명령 한 건의 ID. 같은 명령 재전송에는 같은 ID 사용 |
| sessionId | 통합 플레이 동안 유지하는 세션 ID |
| experienceId | 방에서 체험을 시작할 때 프론트가 생성하는 실행 묶음 ID |
| roomId | 논리 방 ID. 표시 이름·에셋 ID가 아니라 고정 식별자 |
| action | start_experience 또는 end_experience |
| scenarioId / scenarioVersion | 시작할 시나리오와 고정 버전. 같은 방에 여러 직업 체험이 있으면 반드시 구별 |
| reason | 종료 요청에서는 USER_REQUESTED_END. 결과 성공/실패를 프론트가 지정하지 않음 |

## ID와 라우팅

- 예시 매핑은 office → 논리 sceneId office → career-net-253-office-documents v001입니다. 이는 연동용 제안 매핑이며 현재 런타임 라우터 구현을 뜻하지 않습니다. 실제 지원 방·시나리오 목록은 Unity 구현자가 전달해야 합니다.
- 같은 방을 다시 여는 것은 새 experienceId입니다. 내부 초기화는 같은 experienceId 아래 새 scenarioRunId로 구별합니다.
- 종료 시 시작에 사용한 roomId·experienceId·sessionId를 그대로 보냅니다. 잘못된 방/실행의 종료 요청이 다른 실행을 끝내면 안 됩니다.
- start/end 호출의 requestId는 서로 다릅니다. 타임아웃 재전송은 새 ID를 만들지 않습니다. 다른 requestId로 이미 끝난 실행을 종료하면 ALREADY_ENDED 제어 오류로 처리합니다.

## 실제 호출 방법

이 문서는 JSON 계약입니다. 구체적인 Unity GameObject·C# 메서드 이름이나 특정 React 렌더링 라이브러리 API는 아직 정하지 않았습니다. Unity 브리지를 구현한 뒤 renderer 어댑터의 send(command)에 연결해야 합니다. 이 JSON을 기존 v005에 보내면 바로 작동한다고 가정하지 마세요.
