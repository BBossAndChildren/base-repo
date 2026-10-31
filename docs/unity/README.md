# 직업체험 프론트·백엔드 목록 전달 v004

이 ZIP은 ID·설명·음향 상태·연동 소스·계약 자료입니다. 실행 WebGL과 효과음 MP3는 별도 실제 연동용 WebGL ZIP에 있습니다. Unity 프로젝트·모델 원본·실행 바이너리를 포함하지 않습니다.

- 테스트 보기: http://127.0.0.1:8212/career-suite-test-v009/ (실행 중인 로컬 서버, 외부 배포 아님).
- 실제 실행물: `career-suite-integration-v005.zip` (31,267,874바이트, SHA-256 `1e0e6c4c9cad4ccc5bf1ebec0b4dd1c0b878c7db16c2e20906193f0b976298f9`).
- 전체 AI 목록: ids/career-experience-descriptions-v001.json 및 CSV. 각 experience에 roomId·scenarioId·scenarioVersion·jobs 문자열 배열·실제 업무 description을 기록했습니다. 71개 방·552개 고유 시나리오·555개 고정 조합입니다.
- 배포 허용 목록: builds/의 새 두 supported-manifest와 ai-build-catalog를 buildId까지 함께 대조합니다. 과거 빌드 목록은 새 빌드의 허용 목록으로 사용하지 않습니다.
- 업데이트·적용 지침: UPDATES.md.

frontend/는 v003 소스·타입·React 예제·오디오 재생기입니다. 실제 배포 WebGL URL과 그 빌드 manifest를 Experience에 전달합니다. 최초 사용자 조작으로 오디오를 활성화해야 하며 iframe 밖 클릭만으로 브라우저 재생 허용을 가정하지 않습니다. audio/는 메타데이터·전체 파일 목록이며 MP3 복제본을 넣지 않았습니다. WebGL ZIP의 site/audio/를 그대로 제공하세요.

현재108종 중34종 파일이 있고74종은 미생성입니다. 기존32종을 보존하고012·013을 처음 생성했으며 이 두 종의 커넥터 보고 비용은10크레딧입니다. 서비스의 추가 생성 중단 안내와 사용자의 최신 추가 비용 없음 지시에 따라 이후 생성·업그레이드를 하지 않았습니다. 실제 청구서·상업 권리는 독립 확인하지 않았습니다. 실제 업무 소스는40개 키를 발행하며30개에 파일이 있습니다. 파일이 있는 나머지4개는 라이브러리용이고, 발행 키 중10개는 파일이 없어 대체음 없이 생략합니다. 모든108종·34종이 게임 중 재생된다고 주장하지 않습니다.

backgroundColor는 불투명 #RRGGBB 표시 설정이며 모델·공용 팔레트를 바꾸지 않습니다. 시작·종료·과정 카운트와 별개입니다. 오디오도 presentation side channel이며 업무 원장 eventId·sequence·횟수를 늘리지 않습니다.

examples/와 contracts/의 JSON은 가상 fixture입니다. actual/previous-release-v006 및 earlier-builds는 과거 실제 검수이며 새 v009/v005 통과로 승계하지 않습니다. actual/intermediate-audio-v007은 카드 목적지 안내 변경 전 중간 음향 빌드이며 최종 검수를 대신하지 않습니다. actual/current-builds가 이번 새 빌드의 실제 증거이며 각 파일의 검수 범위만 적용합니다. 소스 프로브와 모의 오디오 컨트롤러 검사는 실제 브라우저 재생이 아닙니다.

process는 누적 스냅샷이며 더하지 않습니다. 수신자는 eventId로 중복 제거하고 sequence별 최신 범위를 표시합니다. 종료 data.events와 실시간 이벤트를 다시 합산하지 않습니다. 종료 미수신은 pending_reconciliation이며 실제 서버 인증·소유권·lease·fence 검증 없이 프론트가 사용자 포기로 정산하지 않습니다. 로컬 fsync ACK는 실제 운영 백엔드 통합 검증이 아닙니다.

전체 원래 전문 업무와554개 미구현 특수분기, 모든555개 조합 완주·모든 입력 방식·실제 운영 백엔드는 미완료/미검증입니다. 3D프린팅은 실제 프린터 운전이 아닌 출력 전 준비·검수·인계입니다. 실제 source/source-data·포함·실행 검증을 구분한 전체 상태는 ids/career-full-targets-v003.json을 참고하세요.

기본 허용 목록은 `builds/production-supported-manifest.json`(career-suite-integration-v005)와 `builds/test-supported-manifest.json`(career-suite-test-v009)다. 기본 AI 설명 목록은 `builds/production-ai-build-catalog.json`과 `builds/test-ai-build-catalog.json`이며 같은 최종 빌드를 가리킨다. 버전 이름 파일은 각각 `career-suite-integration-v005-supported-manifest.json` / `career-suite-integration-v005-ai-build-catalog.json`, `career-suite-test-v009-supported-manifest.json` / `career-suite-test-v009-ai-build-catalog.json`이다. 기본 별칭4개와 버전 이름 파일4개는 최종 소스와 바이트가 같고 각555행의 buildId·jobs·description을 대조했다. 이전 빌드 목록은 `builds/earlier-builds/`에만 보존하며 최종 실행 선택에 사용하지 않는다.
