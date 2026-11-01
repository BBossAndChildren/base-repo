/**
 * 3D 체험 카드의 방 미리보기 (#171). 인트로 에셋의 방 모델(`<introAssetBase>models/<roomId>.glb`)을
 * 비스듬한 위에서 천천히 돌려 보여 준다. three.js 는 이 파일을 쓸 때만 따로 불러온다 (게임 화면 첫 로딩에 섞지 않음).
 * 인트로 원본 코드(src/pages/intro)는 쓰지 않는다.
 */
export interface RoomPreviewOptions {
  /** 천천히 돌리기. 모션 줄이기 설정이면 false */
  rotate: boolean
  /** 배경색 (CSS 역할 변수 값) */
  background: string
}

/** canvas 를 붙이고 정리 함수를 돌려준다. 모델을 못 받거나 WebGL 이 없으면 reject */
export async function mountRoomPreview(host: HTMLElement, url: string, options: RoomPreviewOptions): Promise<() => void> {
  const [T, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')])
  const width = host.clientWidth || 280
  const height = host.clientHeight || 180
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.setClearColor(new T.Color(options.background))
  const scene = new T.Scene()
  scene.add(new T.HemisphereLight(0xffffff, 0x445566, 2.2))
  const sun = new T.DirectionalLight(0xffffff, 2)
  sun.position.set(4, 8, 5)
  scene.add(sun)
  const camera = new T.PerspectiveCamera(30, width / height, 0.1, 500)

  let gltf: { scene: import('three').Object3D }
  try {
    gltf = await new GLTFLoader().loadAsync(url)
  } catch (error) {
    renderer.dispose()
    throw error
  }
  const room = gltf.scene
  // 방 크기에 맞춰 가운데 두고, 비스듬한 위(아이소메트릭에 가까운 각도)에서 본다
  const box = new T.Box3().setFromObject(room)
  const size = box.getSize(new T.Vector3())
  const center = box.getCenter(new T.Vector3())
  room.position.sub(center)
  const pivot = new T.Group()
  pivot.add(room)
  pivot.rotation.y = Math.PI / 4
  scene.add(pivot)
  const radius = Math.max(size.x, size.y, size.z)
  camera.position.set(0, radius * 1.05, radius * 1.55)
  camera.lookAt(0, -size.y * 0.1, 0)

  host.appendChild(renderer.domElement)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  let frame = 0
  let last = performance.now()
  const draw = (now: number) => {
    if (options.rotate) pivot.rotation.y += ((now - last) / 1000) * 0.25
    last = now
    renderer.render(scene, camera)
    if (options.rotate) frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  const resize = new ResizeObserver(() => {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (!options.rotate) renderer.render(scene, camera)
  })
  resize.observe(host)

  return () => {
    cancelAnimationFrame(frame)
    resize.disconnect()
    room.traverse((node) => {
      const mesh = node as import('three').Mesh
      mesh.geometry?.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
      for (const material of materials) {
        for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) (value as import('three').Texture).dispose()
        material.dispose()
      }
    })
    renderer.dispose()
    renderer.domElement.remove()
  }
}
