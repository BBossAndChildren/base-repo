# Career Suite 효과음 연동 v001

기준은 저장소 AGENTS.md입니다. 기존 사용자가 생성한 MP3를 재사용하며 음성 합성·내레이션·새 유료 생성은 이 프론트엔드 작업에서 하지 않았습니다. 자료는 web/career-audio/v002/audio-manifest.json이며 생성·사용처·비용 원장은 해당 catalog에서 조회합니다. 이 컨트롤러는 준비된 파일 수에 제한을 두지 않습니다. 미준비 키는 진단 기록만 남기고 소리를 재생하지 않습니다.

## 포함과 사용

web/career-preview/v003/를 WebGL 출력 frontend/로, web/career-audio/v002/를 출력 audio/로 복사합니다. React 예제는 기존 설치된 Vite/React로 빌드한 dist/ 내용을 frontend에 겹쳐 놓습니다. 두 Unity 템플릿은 같은 suite-host.js를 불러오며 그 모듈이 효과음 UI를 설치합니다.

게임 iframe 안의 실제 클릭·키 입력으로 WebAudio 잠금을 해제합니다. 부모 창의 시작 클릭이 자식 창의 재생을 허용한다고 간주하지 않습니다. 자식 창에 활성화 버튼과 활성 상태를 표시합니다. 음소거·음량은 origin별 localStorage에 보존하며 저장 제한 시에도 게임을 계속할 수 있습니다. 자동 재생 허용 전 소리는 예약하여 뒤늦게 재생하지 않습니다. 테스트 목록은 준비된 소리를 한 번만 미리듣고 미준비 항목을 명시합니다. 반복 원본도 미리듣기에서는 한 번만 재생합니다.

## Unity → 프론트엔드

Unity jslib는 career-experience:audio CustomEvent의 detail로 다음 데이터를 보냅니다. 같은 페이지 window.careerAudio.cue(detail)도 같은 함수입니다. 이 채널은 업무 원본과 별개이며 오디오 횟수를 업무 성공·실수·도움으로 집계하지 않습니다.

```js
{cueId:'unique-source-event/audio-drag',cueKey:'optional-stable-key',
 scope:{sessionId,experienceId,scenarioRunId,scenarioId,scenarioVersion,roomId},
 kind:'drag_pick',operation:'play',clipKey:'drag_pick',priority:30}
```

operation은 play, loop_start, loop_stop, cancel입니다. loop_start에는 안정된 loopId를 주고 loop_stop에서 같은 ID를 사용합니다. manifest의 loop:true만 반복합니다. 범위 변경 시 start 종류 cancel로 새 범위를 먼저 선언합니다. 종료·초기화된 범위의 늦은 cue는 재생하지 않습니다. close/pause/scene/reset/ended cancel은 진행·대기 재생을 모두 무효화합니다. pause 후 일반 play는 차단하고 resume 후 새 동작만 재생합니다. cancel의 명시적 clipKey가 준비되어 있으면 취소 직후 그 한 번의 알림만 허용합니다. reset 다음 새 run이 즉시 시작되면 reset 알림도 새 범위에서 보내야 합니다.

최대 동시 소리 4개·반복 2개, manifest별 cooldownMs, 우선순위 순 교체를 적용합니다. 우선순위 60 이상 알림 중 반복 gain은 40%입니다. 실제 음량은 사용자 음량×manifest gain입니다. close/pause/scene/reset/end, 숨겨진 탭, pagehide는 현재 음원과 비동기 decode를 취소합니다. 이전 onended 콜백은 새 음원을 제거하지 않습니다. 재생 실패는 진단에 남기고 게임 상태를 바꾸지 않습니다.

state()는 활성 소리·범위·준비/미준비 목록·짧은 진단을 반환합니다. subscribe는 상태를 구독합니다. cancel, setEnabled, setVolume, setHidden, unlock, dispose는 수명 관리 API입니다. 타입은 frontend/audio.d.ts입니다.

## 배경 설정

Experience의 backgroundColor prop 또는 client.setPresentation({backgroundColor:'#RRGGBB'})로 설정합니다. 준비 전 값은 ready 후 전달하고 부모/자식 source·origin을 검증합니다. Unity CareerProtocol.SetPresentation은 Camera 배경을 설정하며 진단은 career-experience:presentation으로 분리합니다. 새 업무 요청이나 과정 이벤트를 만들지 않습니다. 값을 생략하면 기존 배경입니다. 예제 URL backgroundColor의 #은 %23으로 인코딩합니다.

## 검수

docs/machine/evidence/career-audio-controller-v001/inline-controller-tests.json은 파일을 추가하지 않은 인라인 mock 검사 18건입니다. 잠금·중복·cooldown·범위 전환·취소·제한·ducking·음량 보존·오류·지연 콜백·RGB 및 origin/source 검증을 확인했습니다. 실제 MP3 청취나 새 Unity WebGL 실행 검증은 아닙니다. 새 빌드 실제 재생·청취·UI는 별도 실행 증거가 필요합니다.
