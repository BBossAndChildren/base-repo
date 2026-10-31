# 백엔드 전달 범위

실제 API URL·인증·소유권 서버 계약은 제공되지 않았습니다. `../frontend/backend.js`와 `backend.d.ts`가 호출 어댑터·타입이며 실제 서버 구현을 대신하지 않습니다.

Unity 원본 이벤트를 보존하고 (sessionId,eventId)로 중복 제거합니다. 같은 ID의 다른 내용은 충돌로 격리합니다. process는 누적 스냅샷이므로 더하지 않고 범위별 최신 sequence로 대체합니다. 순서 역전 원본도 보존하고 종료 data.events와 이중 집계하지 않습니다.

ACK는 sessionId/eventId/stored:true를 확인합니다. Unity 발생·React 수신·서버 저장 완료는 별도 상태입니다. 로컬 수신기 server.mjs의 fsync ACK는 실제 운영 서버 통합 성공이 아닙니다.

종료 미수신은 pending_reconciliation으로 유지합니다. 실제 인증 소유권·명시적 새 시작·lease 만료·원자적 fence를 서버가 검증해야 하며 heartbeat 중단이나 클라이언트 타이머만으로 중단하지 않습니다. 정책의 30초 heartbeat/120초 lease는 구현 요구이며 제공된 서비스가 아닙니다.

서버 정산은 career-experience-resolution/experience.reconciled, resolutionId+revision이며 Unity experience.ended/eventId를 만들지 않습니다. 검증된 늦은 실제 종료는 원본을 보존하고 같은 정산의 revision을 정정하며 새 체험의 결과를 덮지 않습니다.

필요 정보: 이벤트/미확정/정산/heartbeat 실제 endpoint, 인증·CSRF·CORS, 저장 ACK, 사용자 소유권·lease·fence·새 실행 승인, 원본 조회·보존 정책. 비밀키를 WebGL이나 브라우저 코드에 넣지 않습니다.
