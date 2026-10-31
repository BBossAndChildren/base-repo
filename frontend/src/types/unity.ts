// Unity 연결 코드(빌드에 포함된 frontend/client.js)를 쓰기 위한 최소 타입.
// 원본 규격: docs/unity/frontend/client.d.ts · docs/unity/contracts/. 실제 코드는 빌드에서 불러온다 (lib/experience/runtime.ts)

export interface ExperienceSelection {
  buildId: string
  roomId: string
  scenarioId: string
  scenarioVersion: string
}

/** Unity 이벤트 봉투 (realtime-v002). 백엔드에 원본 그대로 보낸다 */
export interface CareerEvent extends ExperienceSelection {
  schemaVersion: 1
  protocol: 'career-experience'
  eventId: string
  sequence: number
  sessionId: string
  experienceId: string
  requestId: string | null
  type: string
  result: { outcome: 'pending' | 'completed' | 'failed' | 'aborted'; success: boolean | null; completionCode: string | null; data: Record<string, unknown> }
  [key: string]: unknown
}

export interface StorageAck {
  stored: true
  sessionId: string
  eventId: string
  [key: string]: unknown
}

export interface SupportedManifest {
  build: { build_id: string }
  supported: ExperienceSelection[]
}

export interface ClientStatus {
  value: string
  sessionId: string
  experienceId: string | null
  [key: string]: unknown
}

export interface Outbox {
  enqueue(event: CareerEvent): void
  flush(): Promise<void>
  state(): { rows: Array<{ id: string; status: 'pending' | 'stored' }>; persistenceError: string | null }
}

export interface ExperienceClient {
  sessionId: string
  start(selection: ExperienceSelection, ids?: { requestId?: string; experienceId?: string }): Promise<CareerEvent>
  end(ids?: { requestId?: string }): Promise<CareerEvent>
  setPresentation(value: { backgroundColor: string }): unknown
  dispose(): void
}

/** 빌드의 client.js 가 내보내는 함수 */
export interface ExperienceRuntime {
  createOutbox(options: { send: (event: CareerEvent) => Promise<StorageAck>; key?: string }): Outbox
  createExperienceClient(options: {
    frame: HTMLIFrameElement
    manifest: SupportedManifest
    sessionId: string
    outbox: Outbox
    onEvent?: (event: CareerEvent) => void
    onStatus?: (status: ClientStatus) => void
  }): ExperienceClient
}

/** 정산 응답 (contracts/reconciliation-v003/resolution-response.schema.json) */
export interface ExperienceResolution {
  type: 'experience.reconciled'
  experienceId: string
  lifecycleStatus: 'pending_reconciliation' | 'deferred_active' | 'interrupted' | 'not_started' | 'ended'
  [key: string]: unknown
}
