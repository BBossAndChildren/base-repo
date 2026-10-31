import { createContext, useContext } from 'react'

export interface PlayerContextValue {
  playerId: string
  /** 서버가 모르는 게스트(401)일 때: 저장된 ID 를 지우고 새로 발급받는다 */
  resetPlayer(): Promise<void>
}

export const PlayerContext = createContext<PlayerContextValue | null>(null)

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer 는 PlayerGate 안에서만 쓸 수 있습니다')
  return value
}
