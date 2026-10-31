import { useCallback, useEffect, useState } from 'react'
import { ApiError, gameApi } from '../api'
import { usePlayer } from '../app/playerContext'
import type { PlayResume } from '../types/api'

export type PlayLoadState = { status: 'loading' } | { status: 'ready'; play: PlayResume } | { status: 'error'; error: ApiError }

type Settled = { key: string } & ({ status: 'ready'; play: PlayResume } | { status: 'error'; error: ApiError })

/** 플레이 불러오기 (03 1-7). 모르는 게스트(401)면 새로 발급받는다 */
export function usePlayLoader(playId: string | undefined) {
  const { resetPlayer } = usePlayer()
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const key = `${playId ?? ''}#${attempt}`

  useEffect(() => {
    if (!playId) return
    let cancelled = false
    gameApi
      .getPlay(playId)
      .then((play) => {
        if (!cancelled) setSettled({ key, status: 'ready', play })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN')
        if (apiError.type === 'UNKNOWN_PLAYER') void resetPlayer()
        setSettled({ key, status: 'error', error: apiError })
      })
    return () => {
      cancelled = true
    }
  }, [playId, key, resetPlayer])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  let state: PlayLoadState
  if (!playId) state = { status: 'error', error: new ApiError(404, 'NOT_FOUND') }
  else if (!settled || settled.key !== key) state = { status: 'loading' }
  else state = settled.status === 'ready' ? { status: 'ready', play: settled.play } : { status: 'error', error: settled.error }

  return { state, retry }
}
