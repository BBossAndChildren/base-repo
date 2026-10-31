# 기존 React 전달본에 토큰 추가

이 ZIP은 기존 career-intro-react-v001 소스에 추가하는 디자인 토큰 묶음입니다. 3D 모델이나 node_modules는 들어 있지 않습니다. 새 프로젝트를 한 번에 받을 때는 career-intro-react-v002-source.zip을 사용하세요.

1. src/와 scripts/를 기존 프로젝트의 같은 위치에 복사합니다. 수정 중인 기존 파일은 먼저 보존하세요.
2. `node scripts/build-tokens.mjs`로 토큰을 생성합니다. 생성된 CSS/JS도 함께 포함되어 있어 기본 실행에는 생성 작업을 생략할 수 있습니다.
3. 기존처럼 `npm run dev` 또는 `npm run build`로 실행합니다. JSON을 변경했을 때는 2번을 다시 실행하세요. 전체 v002 프로젝트에서는 npm run build가 토큰 생성을 포함합니다.

CSS/컴포넌트 수정 대신 원하는 값만 tokens prop에 지정할 수도 있습니다. README.md 예시와 src/tokens/tokens.json의 점 경로를 사용하세요. 기존 src/introEngine.js 및 public/intro-assets/는 그대로 재사용합니다. 모델·UV·팔레트는 변경하지 않습니다.
