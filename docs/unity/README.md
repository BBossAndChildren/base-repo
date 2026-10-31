# Unity–React 프론트 연동 전달 패키지 v001

이 ZIP은 **연동 명세·TypeScript 타입·가상 JSON 예시**입니다. WebGL 실행본, React 라이브러리, 작동하는 Unity 통신 브리지는 포함하지 않습니다. 기존 office-assistant-v005는 플레이 가능한 별도 빌드지만, 이 공통 시작/종료 명령과 결과 응답을 아직 구현하지 않았습니다. 이 패키지로 프론트의 목업과 수신 화면을 준비할 수 있습니다.

## 먼저 읽을 파일

1. `CALLS.md` — React → Unity 시작/종료 호출
2. `RESPONSES.md` — Unity → React 준비 완료/체험 종료/제어 오류 응답
3. `INTEGRATION.md` — 연결 순서·담당 범위·중복 처리·검증 항목
4. `types/career-experience.types.ts` — TypeScript 타입 선언(런타임 검증기/SDK 아님)
5. `examples/` — 복사 가능한 원시 통신 JSON 8개
6. `PROTOCOL-SNAPSHOT.md` — 기준 AGENTS.md의 규격 절을 생성 시점 그대로 추출한 고정 스냅샷
7. `MANIFEST.json` — 파일 해시·상태·기준 문서 출처

## 기본 흐름

프론트가 방(roomId)·시나리오를 지정해 시작 → Unity가 방 로딩 후 experience.started → 내부 업무 과정 수집 → 프론트가 체험 종료 호출 → Unity가 experience.ended로 과정·결과·컨텍스트 반환 → 프론트가 응답을 보존하고 Unity 화면 제거.

모든 예시는 가상이며 실측 결과·현재 브리지의 지원 증거가 아닙니다. 예시에서 생략된 원본 이벤트 조회 기능도 현재 구현됐다고 간주하지 않습니다. 규칙의 단일 기준은 원 저장소의 AGENTS.md입니다. 이 패키지는 버전 고정 전달 스냅샷이며 기준 변경 시 새 ZIP 버전으로 재발행합니다.

04~07 응답은 서로 대체되는 종료 사례입니다. 같은 실제 experience에 차례로 보내지 않습니다. 목업 사례를 새로 시작할 때 ID를 실제 새 실행에 맞춰 바꾸고, 종료 요청의 ID와 응답 ID를 일치시키세요.
