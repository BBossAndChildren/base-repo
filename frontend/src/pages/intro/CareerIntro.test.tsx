import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntroState } from './introEngine'

// jsdom 에는 WebGL 이 없어 엔진은 가짜로 바꾼다. 엔진 자체는 브라우저에서 확인 (07 L3 B10~B13)
const engine = vi.hoisted(() => ({
  start: vi.fn(async () => {}),
  togglePause: vi.fn(),
  setMuted: vi.fn(),
  getState: vi.fn(() => ({})),
  destroy: vi.fn(),
  loading: Promise.resolve(),
}))
const created = vi.hoisted(() => ({ options: null as null | { onUpdate: (s: IntroState) => void; onComplete: () => void; assetBase: URL } }))
vi.mock('./introEngine', () => ({
  createIntroEngine: vi.fn((_root: HTMLElement, _config: unknown, options: typeof created.options) => {
    created.options = options
    return engine
  }),
}))

import { CareerIntro } from './CareerIntro'

const CONFIG = { duration_seconds: 24, rooms: [{ roomId: 'PAN-001', name: '공용 업무 사무실', category: 'WORK & IDEAS', src: 'models/PAN-001.glb' }], cues: [{ at: 0, room: 0 }] }
const STATE: IntroState = { time: 0, active: 0, playing: false, started: false, ended: false, loaded: 1, total: 1, ready: true, muted: false, error: null, room: CONFIG.rooms[0] }

describe('CareerIntro (원본 인트로 컴포넌트)', () => {
  beforeEach(() => {
    created.options = null
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('assetBase 의 intro.json 을 읽어 엔진을 만들고, 준비되면 [인트로 재생] 으로 시작한다', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(CONFIG), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<CareerIntro assetBase="https://assets.example/intro-assets/" />)
    expect(screen.getByRole('button', { name: '공간 준비 중' })).toBeDisabled()
    await waitFor(() => expect(created.options).not.toBeNull())
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('https://assets.example/intro-assets/intro.json')
    expect(created.options!.assetBase.href).toBe('https://assets.example/intro-assets/')
    act(() => created.options!.onUpdate(STATE))
    expect(screen.getByRole('status')).toHaveTextContent('1개 공간이 준비되었습니다')
    await userEvent.click(screen.getByRole('button', { name: '인트로 재생 ↗' }))
    expect(engine.start).toHaveBeenCalled()
  })

  it('끝나면 onComplete, 화면을 떠나면 엔진을 정리한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CONFIG), { status: 200 })))
    const onComplete = vi.fn()
    const { unmount } = render(<CareerIntro assetBase="/intro-assets/" onComplete={onComplete} />)
    await waitFor(() => expect(created.options).not.toBeNull())
    act(() => created.options!.onComplete())
    expect(onComplete).toHaveBeenCalledTimes(1)
    unmount()
    expect(engine.destroy).toHaveBeenCalled()
  })

  it('intro.json 을 못 받으면 오류 문구를 보여 주고 onError 를 한 번 부른다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const onError = vi.fn()
    render(<CareerIntro assetBase="/intro-assets/" onError={onError} />)
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onError).toHaveBeenCalledWith('연출 정보를 불러오지 못했습니다 (404).')
    expect(screen.getByRole('status')).toHaveTextContent('404')
  })

  it('모델 로딩 실패(엔진 오류)도 onError 로 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CONFIG), { status: 200 })))
    const onError = vi.fn()
    render(<CareerIntro assetBase="/intro-assets/" onError={onError} />)
    await waitFor(() => expect(created.options).not.toBeNull())
    act(() => created.options!.onUpdate({ ...STATE, ready: false, error: '공간 로딩 실패: 404' }))
    expect(onError).toHaveBeenCalledWith('공간 로딩 실패: 404')
  })
})
