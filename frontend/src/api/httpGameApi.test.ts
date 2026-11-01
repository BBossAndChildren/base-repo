import { afterEach, expect, it, vi } from 'vitest'
import { httpGameApi } from './httpGameApi'
import { clearPlayerId, setPlayerId } from './player'

afterEach(() => { vi.unstubAllGlobals(); clearPlayerId() })

it('체험 제안 거절은 인증 헤더와 세션·원본 제안 ID를 보내고 ACK를 푼다', async () => {
  setPlayerId('player')
  const body = { sessionId: 'session', offerId: 'offer' }
  const ack = { offerId: 'offer', lifecycleStatus: 'declined' }
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, data: ack }), { status: 200 }))
  vi.stubGlobal('fetch', fetcher)
  expect(await httpGameApi.dismissExperienceOffer('play/1', body)).toEqual(ack)
  expect(fetcher).toHaveBeenCalledWith('/api/v1/plays/play%2F1/experience-offers/dismiss', expect.objectContaining({ method: 'POST', credentials: 'omit', headers: expect.objectContaining({ 'X-Player-Id': 'player' }), body: JSON.stringify(body) }))
})
