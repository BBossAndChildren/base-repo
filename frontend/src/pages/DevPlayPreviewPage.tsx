import { useEffect, useState } from 'react'
import { gameApi } from '../api'
import '../styles/play.css'
import type { PlayResume } from '../types/api'
import { PlayView } from './play/PlayView'

// 개발 모드(StrictMode)는 effect 를 두 번 실행하므로, mock 플레이는 한 번만 만든다
let samplePlay: Promise<PlayResume> | null = null

function createSamplePlay(): Promise<PlayResume> {
  samplePlay ??= (async () => {
    const started = await gameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
    for (const message of ['응 나 과학자임', '실험하는 게 재밌어', '축제 체험 해 볼래']) await gameApi.sendTurn(started.playId, { message })
    return gameApi.getPlay(started.playId)
  })()
  return samplePlay
}

/** 개발 전용: mock 플레이를 만들어 게임 화면을 바로 확인한다 (/dev/play). 배포 빌드에는 경로가 없다 */
export function DevPlayPreviewPage() {
  const [play, setPlay] = useState<PlayResume | null>(null)

  useEffect(() => {
    let cancelled = false
    void createSamplePlay().then((resumed) => {
      if (!cancelled) setPlay(resumed)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return play ? <PlayView play={play} /> : <p className="page-narrow muted">mock 플레이를 만드는 중…</p>
}
