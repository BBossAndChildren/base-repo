# 컴포넌트 디자인 토큰 v001

현재 React 인트로의 디자인 값을 추출한 토큰입니다. 색상·타이포그래피·여백·크기·반경·그림자·블러·반응형 값을 유지하며 새 디자인을 임의로 추가하지 않습니다. 3D 모델 팔레트·UV·카메라·71개 맵 큐는 이 토큰의 범위가 아닙니다.

`tokens.json`이 원본입니다. `tokens.css`, `tokenVariables.js`, `index.js`, 상위 `CareerIntro.css`는 `npm run tokens`로 생성합니다. `npm run build`도 이 명령을 실행합니다. CSS 선택자와 토큰 연결은 `CareerIntro.template.css`에 있습니다. 생성 파일을 따로 수정하지 않습니다.

| 계층 | 역할 |
|---|---|
| primitive | 원래 색·폰트·치수·pill 반경·상호작용 시간 |
| semantic | 기본 글자·배경·버튼·포커스의 의미 |
| component | 버튼, 헤더, 브랜드, 타이틀, 공간 캡션, 로딩 카드, 진행 바, 조작 바, 빛 효과의 값 |
| responsive.compact | 700px 이하에서 적용하는 컴포넌트 값 |
| breakpoint.compact | 미디어 쿼리 빌드 값. 실행 중 CSS 변수로 바꾸지 않음 |

스키마는 프로젝트용 `schema_version:3`이며 DTCG 또는 Tokens Studio에 검증 없이 바로 호환된다고 주장하지 않습니다. `{semantic.text.primary}`처럼 토큰 간 참조를 쓰며, 컴파일러가 누락 참조·순환 참조·변수명 충돌을 확인합니다. 복합 그라디언트·테두리 안에서도 참조를 지원합니다.

## React에서 일부 값만 바꾸기

```jsx
<CareerIntro
  assetBase="/intro-assets/"
  tokens={{
    'semantic.text.primary': '#ffffff',
    'semantic.button.primaryBackground': '#b5edce',
    'component.controls.background': '#091416ee',
    'component.button.borderRadius': '12px',
    'responsive.compact.hero.title.fontSize': '32px',
  }}
/>
```

`tokens`에는 토큰의 점 경로와 CSS 문자열/숫자를 전달합니다. 알려지지 않은 경로와 빌드 전용 토큰은 오류로 안내합니다. 이 prop을 바꿔도 Three.js 엔진을 다시 로딩하지 않습니다. `style`에 전달한 CSS 변수는 `tokens`보다 우선합니다. 컴포넌트별 루트에 값이 적용되므로 전역 body 스타일을 바꾸지 않습니다. 다른 UI에서 쓸 때는 `.career-intro` 범위 안에 넣거나 필요한 변수 선언을 해당 컴포넌트의 범위로 옮깁니다.

```jsx
import {toCSSVariables} from './tokens/tokenVariables.js';

<div className="career-intro" style={toCSSVariables({
  'semantic.button.primaryBackground': '#b5edce',
})} />
```

기존 CSS 사용자라면 `tokens/tokens.css`를 먼저, 생성된 `CareerIntro.css`를 다음에 불러옵니다. `--ci-*`는 디자인 변수이며 엔진의 프레임별 `--blackout`, `--bloom`, `--copy`, `--progress`는 바꾸지 않습니다. 자동 테마 전환·Figma 변수 동기화·접근성 인증을 구현했다고 주장하지 않습니다.
