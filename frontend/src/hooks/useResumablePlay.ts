import { useEffect, useState } from 'react'
import { gameApi } from '../api'
import { clearLastPlayId, getLastPlayId } from '../lib/lastPlay'
import type { PlayResume } from '../types/api'

/** 이어 할 수 있는 플레이 (마지막 플레이가 아직 끝나지 않았을 때만). 확인할 수 없으면 기억을 지운다 */
export function useResumablePlay() {
  const [play, setPlay] = useState<PlayResume | null>(null)
  const [checking, setChecking] = useState(() => getLastPlayId() !== null)

  useEffect(() => {
    const lastPlayId = getLastPlayId()
    if (!lastPlayId) return
    let cancelled = false
    gameApi
      .getPlay(lastPlayId)
      .then((resume) => {
        if (cancelled) return
        if (resume.ended) clearLastPlayId()
        else setPlay(resume)
      })
      .catch(() => {
        if (!cancelled) clearLastPlayId()
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { play, checking }
}
