import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { gameApi } from '../api'

/** 개발 전용: 끝난 mock 플레이를 만들어 결말 화면으로 보낸다 (/dev/result). 배포 빌드에는 경로가 없다 */
export function DevResultPreviewPage() {
  const [playId, setPlayId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const play = await gameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
      await gameApi.sendTurn(play.playId, { message: '이제 끝' })
      if (!cancelled) setPlayId(play.playId)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return playId ? <Navigate to={`/play/${playId}/result`} replace /> : <p className="page-narrow muted">mock 플레이를 만드는 중…</p>
}
