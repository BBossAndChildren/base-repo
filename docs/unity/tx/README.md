# 프론트·백엔드 전달 v003 — 종료 응답 없는 체험

이번 확정 사항: 종료 응답 미수신 → 미확정 보존 → 다음 명시적 새 플레이 시작에서 이전 소유권 대조 → 이전 실행이 만료되고 원자적으로 소유권을 회수할 수 있으면 중단 정산합니다. 사용자 포기/오답으로 단정하지 않습니다.

## 적용 순서

1. 기존 실시간/시작/종료 규격은 유지합니다. 5초 종료 응답 대기는 UI 기준일 뿐 중단 확정 기준이 아닙니다. 같은 requestId로 재전송하고 서버에 미확정 기록을 남깁니다.
2. 다음 새 시작 시 reconcile-request.example.json의 request를 인증된 백엔드 API에 전달합니다. 이전 experienceId와 새 newExperienceId는 다릅니다. 인증 소유자는 서버에서 결정합니다.
3. 서버가 실제 종료 원본부터 대조합니다. 살아 있는 다른 탭은 deferred_active, 확인 불가면 pending_reconciliation입니다. 기본 heartbeat 30초/lease 120초는 구현할 정책입니다. 타임아웃 단독으로 종료하지 않습니다.
4. 명시적 새 시작 + 이전 lease 만료 + 원자적 fence가 성립하면 interrupted로 정산합니다. 시작 근거가 없으면 not_started입니다. 재연결만 하는 경우 기존 체험을 유지합니다. 서버 API 경로·인증 방식은 담당 팀이 배포에 맞게 연결해야 하며 현재 배포된 API는 없습니다.
5. 화면 문구: **종료 응답을 받지 못해 이전 체험을 중단 처리했습니다.** 업무 실수/재시도 횟수는 추가하지 않습니다.

## 두 종류 응답을 구분하세요

| 송신자 | protocol / type | 의미 |
|---|---|---|
| Unity | career-experience / experience.ended | 실제 종료 결과 원본 |
| 백엔드 | career-experience-resolution / experience.reconciled | 수신 근거를 바탕으로 한 운영 정산·정정 |

서버 정산을 Unity 종료 이벤트로 위조하지 않습니다. Unity sequence를 생성하지 않고 resolutionId + revision으로 버전을 관리합니다. 업무 result가 불명확하면 null, assessmentStatus는 unavailable입니다. lastObserved는 과거 수신값이므로 최종 횟수로 사용하지 않습니다. 중단 확정과 업무 결과 확정은 별개입니다. 이미 수신한 scenario.completed 결과는 보존하며 출력 1건 성공을 전체 완료로 승격하지 않습니다.

## 지연·중복·다중 탭

동일 요청은 동일 응답을 반환하고, 동일 ID의 다른 내용은 충돌 오류입니다. 실제 종료가 늦게 도착하면 이전 체험·run·소유권을 검증하고 같은 resolutionId의 다음 revision으로 정정합니다. 이전 중단 기록은 보존합니다. 새로운 체험의 결과/카운트를 수정하지 않습니다. fence 후 무효 탭의 신규 행동은 격리하며 발행 시점을 클라이언트 시각만으로 신뢰하지 않습니다. 실제 종료와 정산이 경합하면 원자적으로 실제 종료가 우선합니다.

## 파일

- interruption-contract.json: 기계용 정책/기본값
- reconcile-request.example.json: 프론트 → 백엔드 호출
- resolution-responses.example.json: 중단/미확정/활성/미시작/지연 종료 정정 예시
- resolution-response.schema.json: 서버 응답 JSON Schema
- acceptance-cases.json: 구현 시 확인할 16개 사례(실행한 테스트가 아님)
- career-integration-registry-v001.json: 기존 방 71개·시나리오 552개·소스 설정 21개. 고정 ID는 변경하지 않았습니다.
- realtime-contract.json 및 기존 request/event 예시: 실시간 규격 유지
- PROTOCOL-SNAPSHOT.md: AGENTS.md 기준 절의 고정 스냅샷

예시 파일 schema_version:3은 문서 봉투입니다. 전송할 객체는 request 또는 examples[].response입니다. 전송 객체는 schemaVersion:1입니다. examples의 종료 사례들은 대안이며 동일 체험에 모두 발행하지 않습니다. 마지막 revision2 예시만 첫 interrupted 예시의 지연 정정 사례입니다.

## 상태·검증

이 패키지는 문서/정책/응답 형식입니다. 저장소의 기존 일부 Unity 브리지 코드가 없다는 뜻이 아닙니다. 신규 정산 API·lease·fence·프론트 반영·실제 왕복은 이번 작업에서 구현하거나 실행하지 않았습니다. MANIFEST의 검증은 문서와 ZIP에만 적용됩니다. 실행 WebGL은 포함하지 않습니다. v001/v002는 보존하며 이번 전달은 v003을 사용합니다.
