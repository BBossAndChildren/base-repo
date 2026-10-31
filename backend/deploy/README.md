# 정적 에셋 게이트웨이 (BE14·BE15)

`nginx.conf`는 `/api/`를 Django로 전달하고 `/builds/`, `/intro-assets/`를 읽기 전용으로 제공한다. 프론트 허용 출처는 현재 개발 문서의 Vercel 주소다. 주소가 바뀌면 CORS와 frame-ancestors를 함께 갱신한다.

실제 Unity 전달물 `intro.json`과 `models/PAN-001.glb`~`PAN-071.glb`를 `/srv/intro-assets/`에 배치한다. 이 파일은 저장소에 넣지 않는다. 원본 파일이 없는 경우 설정 테스트 통과를 실제 배치 완료로 표시하지 않는다.

```bash
cd backend
python3 scripts/check_intro_assets.py /srv/intro-assets
docker compose -f compose.yaml -f compose.gateway.yaml up -d --build
```

게이트웨이는 기본 `127.0.0.1:8080`에 열린다. `GATEWAY_PORT`, `INTRO_ASSET_DIR`, `UNITY_BUILD_DIR`로 포트와 호스트 디렉터리를 지정할 수 있다. 터널을 게이트웨이 포트에 연결한다. API의 프록시 헤더는 Cloudflare가 전달한 HTTPS를 보존한다.

GLB 응답은 `model/gltf-binary`, JSON은 `application/json`이고 정상 에셋은 7일 캐시한다. 없는 파일은 404이며 프론트의 인트로 실패 처리를 사용한다. Django 응답 포장이나 별도 인증을 추가하지 않는다.

```bash
# 임시 fixture 전용 Nginx HTTP 검증 (실제 모델 렌더링 검증과 구분)
python3 scripts/test_intro_gateway.py
```

실제 71개 모델 배치 후 Vercel에서 로딩71/71·24초 재생을 별도로 확인한다. 근거: `docs/development/06-deployment.md` 5-2-1, 기능 BE15, 이슈 #67.
