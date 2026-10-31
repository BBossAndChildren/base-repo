// 인트로 3D 엔진. 원본: Unity 담당 career-intro-react-v001 의 src/introEngine.js
// 동작 · 수치 · 연출은 원본 그대로 두고 TypeScript 타입만 붙였다 (docs/development/12-decisions.md 결정 25)
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export interface IntroRoom {
  roomId: string
  name: string
  category?: string
  src: string
}

export interface IntroCue {
  at: number
  room: number
}

/** intro.json 중 엔진이 쓰는 필드 */
export interface IntroConfig {
  duration_seconds: number
  rooms: IntroRoom[]
  cues: IntroCue[]
}

export interface IntroState {
  time: number
  active: number
  playing: boolean
  started: boolean
  ended: boolean
  loaded: number
  total: number
  ready: boolean
  muted: boolean
  error: string | null
  room: IntroRoom | null | undefined
}

export interface IntroEngine {
  start(): Promise<void>
  togglePause(): void
  setMuted(value: boolean): void
  getState(): Record<string, unknown>
  destroy(): void
  loading: Promise<void>
}

interface EngineOptions {
  assetBase: URL
  onUpdate?: (state: IntroState) => void
  onComplete?: () => void
}

type TexturedMaterial = T.Material & { map?: T.Texture | null }
type Closable = { close?: () => void }

const isMesh = (node: T.Object3D): node is T.Mesh => (node as T.Mesh).isMesh === true
const isTexture = (value: unknown): value is T.Texture => (value as T.Texture | null)?.isTexture === true

export function createIntroEngine(root: HTMLElement, config: IntroConfig, { assetBase, onUpdate = () => {}, onComplete = () => {} }: EngineOptions): IntroEngine {
  const $ = <E extends HTMLElement = HTMLElement>(id: string) => root.querySelector<E>(`[data-intro="${id}"]`)!
  const film = $('film')
  const stage = $<HTMLCanvasElement>('stage')
  let disposed = false
  let frameId = 0
  let error: string | null = null
  let lastNotification = ''
  let ready = false
  const models: T.Object3D[] = []
  const history: { at: number; roomId: string; camera: number[]; blackout: number }[] = []
  const loader = new GLTFLoader()
  let radius = 14
  let time = 0
  let playing = false
  let started = false
  let ended = false
  let last = performance.now()
  let active = -1
  let muted = false
  let context: AudioContext | null = null
  let master: GainNode | null = null

  const notify = () => {
    if (disposed) return
    const stamp = [Math.floor(time * 10), active, playing, started, ended, models.length, ready, muted, error].join('|')
    if (stamp === lastNotification) return
    lastNotification = stamp
    onUpdate({ time, active, playing, started, ended, loaded: models.length, total: config.rooms.length, ready, muted, error, room: config.rooms[active] })
  }

  const renderer = new T.WebGLRenderer({ canvas: stage, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const scene = new T.Scene()
  const camera = new T.PerspectiveCamera(34, 1, 0.01, 300)
  const rig = new T.Group()
  scene.add(rig)
  const ambient = new T.HemisphereLight(0xf0fff7, 0x273638, 0.65)
  scene.add(ambient)
  const key = new T.DirectionalLight(0xffefda, 2.7)
  key.position.set(-4, 8, 5)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -10
  key.shadow.camera.right = 10
  key.shadow.camera.top = 10
  key.shadow.camera.bottom = -10
  key.shadow.normalBias = 0.03
  scene.add(key)
  const rim = new T.DirectionalLight(0xc5ffe4, 2.1)
  rim.position.set(5, 4, -5)
  scene.add(rim)
  const fill = new T.DirectionalLight(0xe3d5ff, 0.5)
  fill.position.set(-6, 2, -2)
  scene.add(fill)
  const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ color: 0x000000, opacity: 0.18 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.025
  floor.receiveShadow = true
  scene.add(floor)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const clamp = (x: number) => Math.max(0, Math.min(1, x))
  const smooth = (x: number) => {
    x = clamp(x)
    return x * x * (3 - 2 * x)
  }
  function css(name: string, value: string | number) {
    film.style.setProperty('--' + name, String(value))
  }
  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false)
    camera.aspect = stage.clientWidth / stage.clientHeight
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(root)
  resize()

  // Every model shares this camera path and rig transform. Swapping only toggles visibility.
  function poseAt(seconds: number): [number, number, number] {
    const t = seconds / 12
    const angle = 0.65 + t * Math.PI * 0.65
    return [Math.sin(angle) * radius, radius * (0.68 + 0.04 * Math.sin(t * Math.PI)), Math.cos(angle) * radius]
  }
  function cueAt(seconds: number) {
    let i = 0
    for (let n = 0; n < config.cues.length; n++) {
      if (seconds >= config.cues[n].at) i = n
      else break
    }
    return config.cues[i]
  }
  function swap(index: number, audible: boolean) {
    models.forEach((m, i) => (m.visible = i === index))
    active = index
    renderer.shadowMap.needsUpdate = true
    const room = config.rooms[index]
    history.push({ at: time, roomId: room.roomId, camera: poseAt(time), blackout: time >= 21 ? smooth((time - 21) / 3) : 0 })
    if (audible) whoosh(time >= 15)
  }

  function audioReady() {
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = muted ? 0 : 0.38
      master.connect(context.destination)
    }
    return context.resume()
  }
  function whoosh(fast: boolean) {
    if (!context || !master || muted) return
    const n = context.currentTime
    const d = fast ? 0.24 : 0.65
    const buf = context.createBuffer(1, context.sampleRate * d, context.sampleRate)
    const a = buf.getChannelData(0)
    let seed = 241
    for (let i = 0; i < a.length; i++) {
      seed = (seed * 16807) % 2147483647
      a[i] = ((seed / 2147483647) * 2 - 1) * Math.sin((Math.PI * i) / a.length)
    }
    const src = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    src.buffer = buf
    filter.type = 'bandpass'
    filter.Q.value = 0.7
    filter.frequency.setValueAtTime(450, n)
    filter.frequency.exponentialRampToValueAtTime(fast ? 4200 : 2300, n + d * 0.6)
    filter.frequency.exponentialRampToValueAtTime(240, n + d)
    gain.gain.setValueAtTime(fast ? 0.45 : 0.28, n)
    gain.gain.exponentialRampToValueAtTime(0.001, n + d)
    src.connect(filter).connect(gain).connect(master)
    src.start()
    src.stop(n + d)
  }
  function chime() {
    const ctx = context
    const out = master
    if (!ctx || !out || muted) return
    ;[261.63, 392, 523.25].forEach((f, i) => {
      const n = ctx.currentTime + i * 0.045
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, n)
      g.gain.linearRampToValueAtTime(0.16, n + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, n + 1.8)
      o.connect(g).connect(out)
      o.start(n)
      o.stop(n + 1.9)
    })
  }
  let chimed = false
  function draw(audible = false) {
    const cue = cueAt(time)
    if (active !== cue.room) swap(cue.room, audible)
    const local = time - cue.at
    const fast = time >= 15
    const opening = smooth(time / 2.2)
    const fade = smooth((time - 21) / 3)
    camera.position.fromArray(poseAt(reduced ? 0 : time))
    camera.lookAt(0, radius * 0.12, 0)
    ambient.intensity = 0.18 + opening * 0.72
    key.intensity = 0.15 + opening * 2.55
    rim.intensity = 1.8 + Math.sin(time * 0.45) * 0.3
    fill.intensity = 0.45
    const sweep = clamp(local / (fast ? 0.24 : 0.65))
    css('sweep', sweep * 280 - 140 + '%')
    css('sweep-opacity', reduced ? 0 : (1 - sweep) * (fast ? 0.5 : 0.28))
    const bloom = time >= 20 ? Math.sin(clamp((time - 20) / 3.9) * Math.PI) * 0.4 : 0
    css('bloom', reduced ? 0 : bloom)
    css('blackout', time < 2 ? 1 - smooth(time / 2) : fade)
    css('copy', 1 - smooth((time - 14) / 2))
    css('caption', 1 - smooth((time - 19.5) / 0.8))
    css('atmosphere', 0.75 + opening * 0.25)
    css('progress', time / config.duration_seconds)
    if (time >= 20 && !chimed) {
      chimed = true
      if (audible) chime()
    }
    if (master) master.gain.value = muted ? 0 : 0.38 * (1 - fade)
    renderer.render(scene, camera)
    notify()
  }
  async function start() {
    if (disposed || !ready) return
    try {
      await audioReady()
    } catch {
      // 소리를 켜지 못해도 화면은 재생한다 (원본 동작)
    }
    if (disposed) return
    time = 0
    active = -1
    history.length = 0
    chimed = false
    started = true
    ended = false
    playing = true
    last = performance.now()
    draw(false)
  }
  function togglePause() {
    if (!started || ended) return
    playing = !playing
    last = performance.now()
    notify()
    if (context) {
      if (playing) context.resume().catch(() => {})
      else context.suspend().catch(() => {})
    }
  }
  function setMuted(value: boolean) {
    muted = value
    if (master) master.gain.value = muted ? 0 : 0.38 * (1 - smooth((time - 21) / 3))
    notify()
  }
  function onVisibility() {
    last = performance.now()
    if (context) {
      if (document.hidden) context.suspend().catch(() => {})
      else if (playing) context.resume().catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  function frame(now: number) {
    if (disposed) return
    const dt = Math.max(0, (now - last) / 1000)
    last = now
    if (playing && !document.hidden) {
      const nextCue = config.cues.find((cue) => cue.at > time)
      time = Math.min(time + dt, nextCue?.at ?? config.duration_seconds, config.duration_seconds)
      draw(true)
      if (time === config.duration_seconds) {
        playing = false
        ended = true
        notify()
        onComplete()
      }
    }
    frameId = requestAnimationFrame(frame)
  }
  const loading = (async () => {
    try {
      let extent = 0
      let sharedMaterial: TexturedMaterial | null = null
      for (const room of config.rooms) {
        const gltf = await loader.loadAsync(new URL(room.src, assetBase).href)
        if (disposed) {
          disposeObject(gltf.scene)
          return
        }
        const model = gltf.scene
        const box = new T.Box3().setFromObject(model)
        const size = box.getSize(new T.Vector3())
        const centre = box.getCenter(new T.Vector3())
        const duplicates = new Set<TexturedMaterial>()
        model.position.sub(new T.Vector3(centre.x, box.min.y, centre.z))
        // The 71 GLBs have byte-identical palette images and identical material settings.
        // Share the original first material and texture, without tinting or remapping UVs.
        model.traverse((n) => {
          if (isMesh(n)) {
            n.castShadow = true
            n.receiveShadow = true
            const material = n.material as TexturedMaterial
            if (!sharedMaterial) sharedMaterial = material
            else if (material !== sharedMaterial) {
              duplicates.add(material)
              n.material = sharedMaterial
            }
          }
        })
        for (const material of duplicates) {
          const image = material.map?.source?.data as Closable | undefined
          material.map?.dispose()
          if (image !== (sharedMaterial as TexturedMaterial | null)?.map?.source?.data) image?.close?.()
          material.dispose()
        }
        model.visible = false
        rig.add(model)
        models.push(model)
        extent = Math.max(extent, size.x, size.y, size.z)
        notify()
      }
      radius = extent * 1.9
      camera.near = radius / 1000
      camera.far = radius * 30
      camera.updateProjectionMatrix()
      ready = true
      draw()
      frameId = requestAnimationFrame(frame)
    } catch (e) {
      if (!disposed) {
        error = '공간 로딩 실패: ' + (e instanceof Error ? e.message : String(e))
        notify()
      }
    }
  })()
  function getState() {
    const materials = new Set<T.Material>()
    const textures = new Set<T.Texture>()
    rig.traverse((n) => {
      if (isMesh(n)) {
        const material = n.material as TexturedMaterial
        materials.add(material)
        if (material.map) textures.add(material.map)
      }
    })
    return {
      time,
      playing,
      started,
      ended,
      loaded: models.length,
      total: config.rooms.length,
      ready,
      error,
      roomId: config.rooms[active]?.roomId,
      visibleModels: models.filter((m) => m.visible).length,
      modelMaterials: materials.size,
      modelTextures: textures.size,
      camera: camera.position.toArray(),
      history: history.map((x) => ({ ...x })),
      blackout: film.style.getPropertyValue('--blackout'),
    }
  }
  function disposeObject(object: T.Object3D) {
    const geometries = new Set<T.BufferGeometry>()
    const materials = new Set<T.Material>()
    const textures = new Set<T.Texture>()
    object.traverse((n) => {
      const node = n as Partial<T.Mesh>
      if (node.geometry) geometries.add(node.geometry)
      for (const m of Array.isArray(node.material) ? node.material : [node.material])
        if (m) {
          materials.add(m)
          for (const value of Object.values(m)) if (isTexture(value)) textures.add(value)
        }
    })
    for (const g of geometries) g.dispose()
    for (const t of textures) {
      t.dispose()
      ;(t.source?.data as Closable | undefined)?.close?.()
    }
    for (const m of materials) m.dispose()
  }
  function destroy() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frameId)
    observer.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    context?.close().catch(() => {})
    disposeObject(scene)
    key.shadow.map?.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    models.length = 0
    scene.clear()
  }
  return { start, togglePause, setMuted, getState, destroy, loading }
}
