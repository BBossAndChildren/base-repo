import type {
  CreatePlayerResponse,
  ExperienceSuggestion,
  MyPlaysResponse,
  PauseResponse,
  PlayResult,
  PlayResume,
  StartPlayRequest,
  StartPlayResponse,
  TurnRequest,
  TurnResponse,
} from '../types/api'

/** 화면이 쓰는 백엔드 API (03 1부, 3D 연동 API 는 8단계). 실제 서버와 mock 이 같은 모양을 따른다 */
export interface GameApi {
  /** 1-1 게스트 플레이어 발급 */
  createPlayer(): Promise<CreatePlayerResponse>
  /** 1-2 게임 시작 */
  startPlay(body: StartPlayRequest): Promise<StartPlayResponse>
  /** 1-7 플레이 재개 */
  getPlay(playId: string): Promise<PlayResume>
  /** 일시정지 · 재개 (PATCH 1-7 리소스) */
  setPaused(playId: string, paused: boolean): Promise<PauseResponse>
  /** 1-11 화면 카드용 3D 체험 추천. exclude 를 주면 다시 고르기(무작위) */
  suggestExperience(playId: string, exclude?: string[]): Promise<ExperienceSuggestion>
  /** 1-3 채팅 한 턴 */
  sendTurn(playId: string, body: TurnRequest): Promise<TurnResponse>
  /** 1-5 결말 · 추천 직업 */
  getResult(playId: string): Promise<PlayResult>
  /** 1-6 지난 플레이 기록 */
  listMyPlays(): Promise<MyPlaysResponse>
}
