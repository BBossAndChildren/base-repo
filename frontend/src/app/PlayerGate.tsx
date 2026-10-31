import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, ensurePlayerId, gameApi, type GameApi } from '../api'
import { clearPlayerId } from '../api/player'
import { ErrorScreen, Spinner } from '../components'
import { clearLastPlayId } from '../lib/lastPlay'
import { PlayerContext } from './playerContext'

type GateState = { status: 'loading' } | { status: 'ready'; playerId: string } | { status: 'error'; message: string }

/** 첫 접속 때 게스트 ID 를 준비한다 (FE1). 준비되기 전에는 화면을 그리지 않는다 */
export function PlayerGate({ children, api = gameApi }: { children: ReactNode; api?: GameApi }) {
  const [state, setState] = useState<GateState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ensurePlayerId(api)
      .then((playerId) => {
        if (!cancelled) setState({ status: 'ready', playerId })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof ApiError ? error.message : '게스트 정보를 준비하지 못했어요.' })
      })
    return () => {
      cancelled = true
    }
  }, [api, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const resetPlayer = useCallback(async () => {
    clearPlayerId()
    clearLastPlayId()
    retry()
  }, [retry])

  const value = useMemo(() => (state.status === 'ready' ? { playerId: state.playerId, resetPlayer } : null), [state, resetPlayer])

  if (state.status === 'loading')
    return (
      <div className="page-narrow" style={{ textAlign: 'center' }}>
        <Spinner label="준비하는 중" />
      </div>
    )
  if (state.status === 'error') return <ErrorScreen message={state.message} onRetry={retry} />
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}
