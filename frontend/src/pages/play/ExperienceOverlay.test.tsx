import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExperienceApi } from '../../api'
import { ToastProvider } from '../../components'
import { getPendingExperience, setPendingExperience } from '../../lib/pendingExperience'
import type { ExperienceOffer } from '../../types/api'
import type { CareerEvent, ClientStatus, ExperienceRuntime, Outbox, StorageAck, SupportedManifest } from '../../types/unity'
import { ExperienceOverlay } from './ExperienceOverlay'

const OFFER: ExperienceOffer = {
  buildId: 'career-suite-integration-v005',
  buildUrl: 'https://builds.example.test/builds/career-suite-integration-v005/',
  roomId: 'PAN-002',
  scenarioId: 'career-net-951-experience',
  scenarioVersion: 'v002',
  title: '주민 문화행사 준비',
  jobs: ['행사기획자'],
  reason: '이유',
}
const MANIFEST: SupportedManifest = {
  build: { build_id: OFFER.buildId },
  supported: [{ buildId: OFFER.buildId, roomId: OFFER.roomId, scenarioId: OFFER.scenarioId, scenarioVersion: OFFER.scenarioVersion }],
}

function event(type: string, experienceId: string, outcome: CareerEvent['result']['outcome'] = 'pending'): CareerEvent {
  return {
    schemaVersion: 1,
    protocol: 'career-experience',
    eventId: crypto.randomUUID(),
    sequence: 1,
    sessionId: 'session-1',
    experienceId,
    requestId: null,
    type,
    buildId: OFFER.buildId,
    roomId: OFFER.roomId,
    scenarioId: OFFER.scenarioId,
    scenarioVersion: OFFER.scenarioVersion,
    result: { outcome, success: null, completionCode: null, data: {} },
  }
}

/** Unity 연결 코드 대신 끼우는 가짜. 테스트가 준비 · 이벤트 · 응답을 직접 일으킨다 */
function fakeRuntime() {
  const sent: CareerEvent[] = []
  let onStatus: ((status: ClientStatus) => void) | undefined
  let onEvent: ((event: CareerEvent) => void) | undefined
  let outbox: Outbox | undefined
  let send: ((event: CareerEvent) => Promise<StorageAck>) | undefined
  const client = {
    sessionId: 'session-1',
    start: vi.fn(async (_selection: unknown, ids?: { experienceId?: string }) => event('experience.started', ids?.experienceId ?? '')),
    end: vi.fn(),
    setPresentation: vi.fn(),
    dispose: vi.fn(),
  }
  const runtime: ExperienceRuntime = {
    createOutbox: (options) => {
      send = options.send
      outbox = {
        enqueue: (e) => sent.push(e),
        flush: async () => {
          for (const e of sent.splice(0)) await send?.(e)
        },
        state: () => ({ rows: [], persistenceError: null }),
      }
      return outbox
    },
    createExperienceClient: (options) => {
      onStatus = options.onStatus
      onEvent = (e) => {
        options.outbox.enqueue(e)
        options.onEvent?.(e)
      }
      return client
    },
  }
  return {
    runtime,
    client,
    ready: () => act(() => onStatus?.({ value: 'ready', sessionId: 'session-1', experienceId: null })),
    emit: (e: CareerEvent) => act(() => onEvent?.(e)),
  }
}

function fakeApi(overrides: Partial<ExperienceApi> = {}) {
  const api: ExperienceApi = {
    sendEvent: vi.fn(async (_playId: string, e: CareerEvent) => ({ stored: true as const, sessionId: e.sessionId, eventId: e.eventId })),
    reconcile: vi.fn(async (_playId: string, request) => ({ type: 'experience.reconciled' as const, experienceId: request.experienceId, lifecycleStatus: 'interrupted' as const })),
    heartbeat: vi.fn(async () => ({ leaseExpiresAt: '' })),
    markPending: vi.fn(async () => ({})),
    ...overrides,
  }
  return api
}

function renderOverlay(options: { runtime?: ExperienceRuntime; api?: ExperienceApi; manifest?: () => Promise<SupportedManifest> } = {}) {
  const fake = fakeRuntime()
  const api = options.api ?? fakeApi()
  const onClose = vi.fn()
  render(
    <ToastProvider>
      <ExperienceOverlay
        playId="play-1"
        sessionId="session-1"
        offer={OFFER}
        onClose={onClose}
        api={api}
        loadRuntime={async () => options.runtime ?? fake.runtime}
        fetchManifest={options.manifest ?? (async () => MANIFEST)}
      />
    </ToastProvider>,
  )
  return { ...fake, api, onClose, user: userEvent.setup() }
}

describe('ExperienceOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('빌드를 iframe 으로 열고 parentOrigin 을 붙인다. 준비 전에는 불러오는 중', async () => {
    renderOverlay()
    const frame = await screen.findByTitle('직업 3D 체험')
    const src = new URL(frame.getAttribute('src') ?? '')
    expect(src.href.startsWith(`${OFFER.buildUrl}index.html`)).toBe(true)
    expect(src.searchParams.get('parentOrigin')).toBe(window.location.origin)
    expect(screen.getByText('3D 체험을 불러오고 있어요')).toBeInTheDocument()
  })

  it('준비되면 [체험 시작하기] 를 눌러 시작하고, 체험 중에는 [체험 종료하기] 와 효과음 안내', async () => {
    const { ready, client, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    expect(client.start).toHaveBeenCalledWith(
      { buildId: OFFER.buildId, roomId: OFFER.roomId, scenarioId: OFFER.scenarioId, scenarioVersion: OFFER.scenarioVersion },
      expect.objectContaining({ experienceId: expect.any(String), requestId: expect.any(String) }),
    )
    expect(await screen.findByRole('button', { name: '체험 종료하기' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('효과음 켜기')
    expect(getPendingExperience()?.roomId).toBe('PAN-002')
  })

  it('Unity 이벤트를 백엔드에 원본 그대로 보낸다', async () => {
    const { ready, emit, api, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    const e = event('object.selected', getPendingExperience()!.experienceId)
    emit(e)
    await waitFor(() => expect(api.sendEvent).toHaveBeenCalledWith('play-1', e))
  })

  it('종료하면 저장 중 안내 후 체험 결과로 닫히고, 미확인 체험 기억을 지운다', async () => {
    const { ready, client, onClose, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    let resolveEnd!: (e: CareerEvent) => void
    client.end.mockReturnValueOnce(new Promise((resolve) => (resolveEnd = resolve)))
    await user.click(await screen.findByRole('button', { name: '체험 종료하기' }))
    expect(screen.getByText('체험 기록을 저장하는 중…')).toBeInTheDocument()
    resolveEnd(event('experience.ended', getPendingExperience()!.experienceId, 'completed'))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('completed'))
    expect(getPendingExperience()).toBeNull()
  })

  it('Unity 가 스스로 체험을 끝내도 결과로 닫힌다', async () => {
    const { ready, emit, onClose, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    emit(event('experience.ended', getPendingExperience()!.experienceId, 'aborted'))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('aborted'))
  })

  it('종료 응답이 5초 안에 없으면 미수신 기록을 보내고 토스트 후 닫는다 (기억은 남겨 다음에 정산)', async () => {
    const { ready, client, api, onClose, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    client.end.mockRejectedValueOnce(Object.assign(new Error('RESPONSE_UNCONFIRMED'), { code: 'RESPONSE_UNCONFIRMED' }))
    await user.click(await screen.findByRole('button', { name: '체험 종료하기' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('pending'))
    expect(api.markPending).toHaveBeenCalledWith('play-1', expect.objectContaining({ reason: 'END_RESPONSE_TIMEOUT', roomId: 'PAN-002' }))
    expect(screen.getByText('체험 기록 확인이 늦어지고 있어요. 텍스트로 이어갈게요.')).toBeInTheDocument()
    expect(getPendingExperience()).not.toBeNull()
  })

  it('이전 체험의 종료 응답이 없었으면 새 체험 전에 정산하고, 중단이면 토스트', async () => {
    setPendingExperience({ playId: 'play-1', sessionId: 'session-1', experienceId: 'old-exp', roomId: 'PAN-002' })
    const { ready, api, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    expect(api.reconcile).toHaveBeenCalledWith('play-1', expect.objectContaining({ experienceId: 'old-exp', trigger: 'NEW_PLAY_START', protocol: 'career-experience-resolution' }))
    expect(await screen.findByText('종료 응답을 받지 못해 이전 체험을 중단 처리했어요.')).toBeInTheDocument()
    expect(getPendingExperience()?.experienceId).not.toBe('old-exp')
  })

  it('시작이 실패하면 오류 모달 → [텍스트로 계속하기]', async () => {
    const { ready, client, onClose, user } = renderOverlay()
    await screen.findByTitle('직업 3D 체험')
    ready()
    client.start.mockRejectedValueOnce(Object.assign(new Error('UNKNOWN_ROOM'), { code: 'UNKNOWN_ROOM' }))
    await user.click(await screen.findByRole('button', { name: '체험 시작하기' }))
    const dialog = await screen.findByRole('dialog', { name: '3D 체험을 종료했어요' })
    expect(dialog).toHaveTextContent('지금까지 한 체험은 저장되었어요')
    await user.click(screen.getByRole('button', { name: '텍스트로 계속하기' }))
    expect(onClose).toHaveBeenCalledWith('error')
  })

  it('빌드를 불러오지 못하면 토스트 후 건너뛴다', async () => {
    const { onClose } = renderOverlay({ manifest: async () => Promise.reject(new Error('MANIFEST_HTTP_404')) })
    expect(await screen.findByText('3D 체험을 불러오지 못했어요. 이번 체험은 건너뛰고 텍스트로 이어갈게요.')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledWith('skipped')
  })

  it('빌드 지원 목록에 없는 체험이면 안내 후 건너뛴다', async () => {
    const { onClose } = renderOverlay({ manifest: async () => ({ ...MANIFEST, supported: [] }) })
    expect(await screen.findByText('지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요.')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledWith('skipped')
  })

  it('준비 전에 [다음에 할게요] 로 닫을 수 있다', async () => {
    const { onClose, user } = renderOverlay()
    await user.click(await screen.findByRole('button', { name: '다음에 할게요' }))
    expect(onClose).toHaveBeenCalledWith('skipped')
  })
})
