# 프론트 연결 순서와 역할

## 프론트 담당

1. 프레임/Unity 인스턴스를 준비하고 수신 리스너를 먼저 등록합니다.
2. sessionId·experienceId·requestId를 생성하고 시작 JSON을 보냅니다.
3. 대응하는 experience.started를 받은 뒤 체험 준비 상태를 표시합니다.
4. ‘체험 종료’ 버튼에서는 종료 JSON을 보내고 종료 응답을 기다립니다.
5. roomId·experienceId·sessionId·requestId가 현재 호출과 맞는지 확인합니다.
6. experience.ended를 eventId로 중복 제거하고 원본 결과를 보존합니다. 필요하면 서버 저장도 이 시점에 연결합니다.
7. 결과 보존 후 Unity를 종료/언마운트합니다. 응답 전 제거하거나 타임아웃을 성공으로 처리하지 않습니다.

같은 페이지에서는 Unity가 `career-experience:event` CustomEvent의 detail로 객체를 전달하는 규격입니다. iframe은 `{channel:"career-experience", event:응답객체}` 메시지를 사용합니다. iframe의 origin과 source를 확인하고, 송신 targetOrigin은 실제 허용 출처로 지정합니다. 두 경로를 함께 구독하면 eventId로 중복 제거합니다. 제어 오류에는 eventId가 없으므로 requestId로 호출 오류에 연결합니다.

아래는 어댑터를 구현한 뒤 연결하는 의사 코드입니다. 실행 가능한 SDK나 기존 빌드 지원 코드가 아닙니다.

```ts
// transport는 선택한 React–Unity 라이브러리에 맞춰 별도로 구현합니다.
const unsubscribe = transport.subscribe((message) => {
  if (message.roomId !== activeRoomId || message.experienceId !== activeExperienceId) return;
  if (message.type === 'experience.error') {
    showCommandError(message.requestId, message.error);
    return;
  }
  if (message.type !== 'experience.ended' || message.requestId !== pendingEndRequestId) return;
  // eventId 중복 제거 → 저장 완료 확인 → 결과 표시 → Unity 제거 순서
  saveAndShowResult(message);
});
transport.send(startCommand);
// 종료 버튼 클릭 시 transport.send(endCommand)
// 컴포넌트 정리 시 unsubscribe()
```

## Unity 담당 — 아직 구현 필요

공통 명령 수신 브리지와 roomId/시나리오 라우터, 준비 완료 응답, 실제 상태 전이 지점의 과정 기록, 종료 시 카운트·결과·컨텍스트 집계와 응답, 재전송/복구·비동기 종료 방어를 구현합니다. 실제 업무 성공 판정은 Unity에서 수행합니다. 현재 v005의 window.officeState 진단 값은 이 최종 응답 계약의 구현이 아닙니다.

## 함께 확인할 수용 사례

방·실행·요청 ID 일치 / 정상 완료 후 종료 / 작업 도중 종료 / 시작 전 종료 / 초기화 후 이전 run 보존 / 같은 종료 요청 재전송 / 다른 방 종료 차단 / 종료 응답 전 언마운트 방지 / 팝업 닫기와 중단 구별 / 늦은 출력 콜백 차단 / 카운트 누락 null / 실제 Unity–React 왕복 통신.

이 패키지에서 확인한 것은 문서·JSON·타입 구문과 ZIP 구조입니다. 위 실제 연동 수용 사례는 아직 미검증입니다. TypeScript 타입은 런타임 수신 검증을 대신하지 않으므로 경계에서 버전·필수 필드·상관 ID·출처를 검증해야 합니다.
