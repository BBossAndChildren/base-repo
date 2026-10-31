// 인트로 컴포넌트. 원본: Unity 담당 career-intro-react-v001 의 src/CareerIntro.jsx
// v002(디자인 토큰 판): 화면 · 문구 · 조작은 원본 그대로 두고 TypeScript 타입과 onError 알림만 더했다 (docs/development/05-ui-ux.md 화면 0)
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createIntroEngine, type IntroConfig, type IntroEngine, type IntroState } from './introEngine'
import { toCSSVariables, type TokenPath } from '../../design/tokens/tokenVariables'
import './CareerIntro.css'
import './introGuard.css'

const initial: IntroState = { time: 0, active: 0, playing: false, started: false, ended: false, loaded: 0, total: 71, ready: false, muted: false, error: null, room: null }

export interface CareerIntroHandle {
  play(): Promise<void> | undefined
  togglePause(): void
  getState(): Record<string, unknown> | null
}

export interface CareerIntroProps {
  /** 끝에 / 가 있는 에셋 폴더 주소. intro.json 과 models/ 기준 */
  assetBase?: string
  /** 검정 페이드가 끝난 뒤 실행 */
  onComplete?: () => void
  /** 에셋 · WebGL 실패 시 한 번 실행 (원본에 없던 알림) */
  onError?: (message: string) => void
  className?: string
  style?: CSSProperties
  /** 일부 디자인 토큰만 바꾸기 (예: { 'semantic.text.primary': '#fff' }). style 의 CSS 변수가 더 우선 */
  tokens?: Partial<Record<TokenPath, string | number>>
}

/** Self-contained React + Three.js intro. assetBase must contain intro.json and models/. */
export const CareerIntro = forwardRef<CareerIntroHandle, CareerIntroProps>(function CareerIntro({ assetBase = './intro-assets/', onComplete, onError, className = '', style, tokens }, ref) {
  const root = useRef<HTMLElement>(null)
  const engine = useRef<IntroEngine | null>(null)
  const completion = useRef(onComplete)
  const failure = useRef(onError)
  const [state, setState] = useState<IntroState>(initial)
  const [capture, setCapture] = useState(false)
  useEffect(() => {
    completion.current = onComplete
    failure.current = onError
  })
  useImperativeHandle(
    ref,
    () => ({
      play: () => engine.current?.start(),
      togglePause: () => engine.current?.togglePause(),
      getState: () => engine.current?.getState() ?? null,
    }),
    [],
  )

  useEffect(() => {
    const abort = new AbortController()
    let mounted = true
    let instance: IntroEngine | null = null
    // 원본은 assetBase 가 바뀔 때 여기서 상태를 초기화했다. 이 앱은 주소가 바뀌면 key 로 다시 마운트한다 (IntroPage)
    const base = new URL(assetBase.endsWith('/') ? assetBase : assetBase + '/', document.baseURI)
    ;(async () => {
      try {
        const response = await fetch(new URL('intro.json', base), { signal: abort.signal })
        if (!response.ok) throw Error(`연출 정보를 불러오지 못했습니다 (${response.status}).`)
        const config = (await response.json()) as IntroConfig
        if (!mounted || !root.current) return
        instance = createIntroEngine(root.current, config, {
          assetBase: base,
          onUpdate: (value) => {
            if (mounted) setState(value)
          },
          onComplete: () => {
            if (mounted) completion.current?.()
          },
        })
        engine.current = instance
      } catch (error) {
        if (mounted && (error as Error).name !== 'AbortError') setState((value) => ({ ...value, error: (error as Error).message }))
      }
    })()
    return () => {
      mounted = false
      abort.abort()
      instance?.destroy()
      if (engine.current === instance) engine.current = null
    }
  }, [assetBase])

  useEffect(() => {
    if (state.error) failure.current?.(state.error)
  }, [state.error])

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.code === 'Escape') {
      setCapture(false)
      return
    }
    if ((event.target as HTMLElement).closest('input,select,textarea,button,[contenteditable="true"]')) return
    if (event.code === 'Space') {
      event.preventDefault()
      engine.current?.togglePause()
    }
    if (event.code === 'KeyR') engine.current?.start()
  }
  const clock = '00:' + String(Math.floor(state.time)).padStart(2, '0') + ' / 00:24'
  const number = String(state.active + 1).padStart(2, '0')
  return (
    <section ref={root} className={`career-intro ${capture ? 'capture' : ''} ${className}`} style={{ ...toCSSVariables(tokens), ...style }} tabIndex={0} onKeyDown={handleKeys} aria-label="직업 공간 인트로">
      <main data-intro="film" aria-label="전체 공간 인트로">
        <div className="atmosphere" />
        <div className="halo" />
        <canvas data-intro="stage" aria-label="연속된 카메라 경로로 교체되는 3D 공간" />
        <div className="grain" />
        <div data-intro="sweep" />
        <div data-intro="bloom" />
        <header>
          <span className="brand">
            CAREER <b>SPACES</b>
          </span>
          <span className="edition">A WORLD OF POSSIBILITIES</span>
        </header>
        <section className="copy">
          <p className="eyebrow">EXPLORE YOUR NEXT CHAPTER</p>
          <h1>
            가능성이
            <br />
            펼쳐지는 공간.
          </h1>
          <p className="subtitle">{state.total}개의 공간, 새로운 나의 시작.</p>
        </section>
        <div data-intro="room-caption">
          <span data-intro="room-number">
            {number} / {state.total}
          </span>
          <div>
            <p data-intro="room-category">{state.room?.category}</p>
            <h2>{state.room?.name}</h2>
          </div>
        </div>
        <div data-intro="chapter">
          <span>{state.time < 15 ? 'DISCOVER' : state.time < 20 ? 'POSSIBILITIES' : 'YOUR NEXT CHAPTER'}</span>
          <span data-intro="chapter-line" />
          <span>{state.time < 15 ? `${number} — ${state.total}` : `${state.total} SPACES / ONE JOURNEY`}</span>
        </div>
        <div data-intro="blackout" />
      </main>
      <div data-intro="gate" hidden={state.started}>
        <div className="gate-card">
          <span className="eyebrow">CAREER SPACES · INTRO FILM</span>
          <h2>
            새로운 가능성의
            <br />
            문을 열다.
          </h2>
          <p role="status">{state.error ?? (state.ready ? `${state.total}개 공간이 준비되었습니다. 소리와 함께 재생됩니다.` : `${state.loaded} / ${state.total} 공간 준비 완료`)}</p>
          <progress max={state.total} value={state.loaded} />
          <button disabled={!state.ready} onClick={() => engine.current?.start()}>
            {state.ready ? '인트로 재생 ↗' : '공간 준비 중'}
          </button>
          <p className="gate-note">24초 · 대표 5개 → 전체 {state.total}개 · 전환하며 페이드아웃</p>
        </div>
      </div>
      <nav data-intro="controls" aria-label="인트로 재생 조작">
        <button disabled={!state.started || state.ended} onClick={() => engine.current?.togglePause()}>
          {state.playing ? '일시정지' : '계속 재생'}
        </button>
        <button disabled={!state.ready} onClick={() => engine.current?.start()}>
          다시 보기
        </button>
        <button aria-pressed={!state.muted} onClick={() => engine.current?.setMuted(!state.muted)}>
          {state.muted ? '소리 꺼짐' : '소리 켜짐'}
        </button>
        <button
          aria-pressed={capture}
          onClick={() => {
            setCapture((value) => !value)
            root.current?.focus()
          }}
        >
          촬영 화면
        </button>
        <button
          onClick={() => {
            const action = document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen()
            action?.catch(() => {})
          }}
        >
          전체 화면
        </button>
        <span data-intro="time">{clock}</span>
      </nav>
      <div data-intro="finish" hidden={!state.ended}>
        <button onClick={() => engine.current?.start()}>인트로 다시 보기</button>
      </div>
    </section>
  )
})
