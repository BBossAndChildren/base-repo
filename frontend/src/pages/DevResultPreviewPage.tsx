import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { ApiError, gameApi } from '../api'
import { ErrorScreen } from '../components'

// 개발 모드(StrictMode)는 effect 를 두 번 실행하므로, mock 플레이는 한 번만 만든다
let endedPlay: Promise<string> | null = null

function createEndedPlay(): Promise<string> {
  endedPlay ??= (async () => {
    const play = await gameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
    await gameApi.sendTurn(play.playId, { requestId: crypto.randomUUID(), message: '이제 끝' })
    return play.playId
  })()
  // 실패하면 다음 방문 때 다시 만든다
  endedPlay.catch(() => {
    endedPlay = null
  })
  return endedPlay
}

/** 개발 전용: 끝난 mock 플레이를 만들어 결말 화면으로 보낸다 (/dev/result). 배포 빌드에는 경로가 없다 */
export function DevResultPreviewPage() {
  const [playId, setPlayId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createEndedPlay().then(
      (id) => {
        if (!cancelled) setPlayId(id)
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'mock 플레이를 만들지 못했어요.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <ErrorScreen message={error} />
  return playId ? <Navigate to={`/play/${playId}/result`} replace /> : <p className="page-narrow muted">mock 플레이를 만드는 중…</p>
}
