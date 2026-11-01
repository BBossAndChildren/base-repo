import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components'

const mocks = vi.hoisted(() => ({
  env: { apiBaseUrl: 'https://backend.example', useMock: false, introAssetBase: null },
  loadManifest: vi.fn(),
}))

vi.mock('../lib/env', () => ({ env: mocks.env }))
// 3D 화면은 받은 props 만 기록한다 (Unity 없이 페이지 동작 확인)
const overlay = vi.hoisted(() => ({ props: [] as Array<{ offer: unknown; api: { sendEvent: (playId: string, event: unknown) => Promise<unknown> } }> }))
vi.mock('./play/ExperienceOverlay', () => ({
  ExperienceOverlay: (props: (typeof overlay.props)[number]) => {
    overlay.props.push(props)
    return <div role="dialog" aria-label="3D 체험" />
  },
}))
vi.mock('../lib/experience/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/experience/runtime')>()),
  loadManifest: mocks.loadManifest,
}))

const { WorkPage, DEFAULT_BUILD_ID } = await import('./WorkPage')

const row = (n: number) => ({
  buildId: DEFAULT_BUILD_ID,
  roomId: `PAN-00${n}`,
  scenarioId: `scenario-${n}`,
  scenarioVersion: 'v002',
  title: `체험 ${n}`,
  roomName: `방 ${n}`,
  jobs: [`직업 ${n}`],
  description: `설명 ${n}`,
})

function renderPage() {
  return render(
    <ToastProvider>
      <WorkPage />
    </ToastProvider>,
  )
}

describe('/work 3D 체험 테스트', () => {
  beforeEach(() => {
    mocks.env.apiBaseUrl = 'https://backend.example'
    mocks.loadManifest.mockReset()
  })

  it('백엔드 빌드의 허용 목록에서 체험 하나를 골라 보여 주고, 다시 고를 수 있다', async () => {
    mocks.loadManifest.mockResolvedValue({ build: { build_id: DEFAULT_BUILD_ID }, supported: [row(1), row(2)] })
    renderPage()
    expect(mocks.loadManifest).toHaveBeenCalledWith(`https://backend.example/builds/${DEFAULT_BUILD_ID}/`)
    const first = (await screen.findByRole('heading', { level: 2 })).textContent
    expect(['체험 1', '체험 2']).toContain(first)
    expect(screen.getByText('체험 2개', { exact: false })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다른 체험 고르기' }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(first)
    expect(screen.getByRole('button', { name: '체험 시작' })).toBeEnabled()
  })

  it('체험 중 이벤트가 와서 다시 그려져도 같은 체험 정보를 넘긴다 (3D 연결이 다시 만들어지지 않게)', async () => {
    overlay.props.length = 0
    mocks.loadManifest.mockResolvedValue({ build: { build_id: DEFAULT_BUILD_ID }, supported: [row(1)] })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '체험 시작' }))
    const first = overlay.props.at(-1)!
    await act(async () => {
      await first.api.sendEvent('work-test', { type: 'experience.started', sequence: 1, sessionId: 's', eventId: 'e1' })
    })
    expect(overlay.props.length).toBeGreaterThan(1)
    expect(overlay.props.at(-1)!.offer).toBe(first.offer)
  })

  it('목록을 못 받으면 이유를 보여 준다', async () => {
    mocks.loadManifest.mockRejectedValue(new Error('MANIFEST_HTTP_404'))
    renderPage()
    expect(await screen.findByText(/MANIFEST_HTTP_404/)).toBeInTheDocument()
  })

  it('백엔드 주소가 없는 배포(mock)면 안내한다', () => {
    mocks.env.apiBaseUrl = ''
    renderPage()
    expect(screen.getByText('백엔드 주소가 없어요')).toBeInTheDocument()
    expect(mocks.loadManifest).not.toHaveBeenCalled()
  })
})
