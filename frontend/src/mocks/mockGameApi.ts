// 백엔드 게임 API 구현 전 개발용 mock (docs/development/03-api.md 1부 예시 기준).
// 플레이는 메모리에만 저장하므로 새로고침하면 사라진다. 발급한 게스트는 실제 백엔드처럼 남도록 localStorage 에 기억한다
// (새로고침 뒤 브라우저에 남은 게스트 ID 로 시작해도 401 이 나지 않게).
//
// 채팅 입력에 아래 단어가 들어 있으면 해당 상황을 흉내 낸다:
//   "체험"   → 3D 체험 분기 (experience)
//   "없는체험" → 맞는 체험이 없음 (experience: null + notice)
//   "끝"     → 인생 종료 (ended: true). 끝나기 전 결말 요청은 409 NOT_ENDED
//   "오류"   → AI 서버 실패 (502 AI_UNAVAILABLE)
//   "느려"   → 시간 초과 (504 TIMEOUT)
import { ApiError } from '../api/errors'
import type { GameApi } from '../api/gameApi'
import { getPlayerId } from '../api/player'
import { readStorage, removeStorage, writeStorage } from '../lib/storage'
import type { ChatMessage, PlayState, StartPlayRequest, TurnResponse } from '../types/api'

interface MockPlay {
  playId: string
  playerId: string
  sessionId: string
  profile: StartPlayRequest
  state: PlayState
  messages: ChatMessage[]
  turn: number
  ended: boolean
  startedAt: string
}

const PLAYERS_KEY = 'adult-prince.mockPlayers'

function loadPlayers(): string[] {
  try {
    const saved: unknown = JSON.parse(readStorage(PLAYERS_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

const players = new Set<string>(loadPlayers())
const plays = new Map<string, MockPlay>()
let delayMs = 400

/** 테스트용: 응답 지연 조절 · 저장 초기화 */
export const mockControl = {
  setDelay(ms: number) {
    delayMs = ms
  },
  reset() {
    players.clear()
    plays.clear()
    removeStorage(PLAYERS_KEY)
  },
}

const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs))
const uuid = () => crypto.randomUUID()

function currentPlayer(): string {
  const playerId = getPlayerId()
  if (!playerId || !players.has(playerId)) throw new ApiError(401, 'UNKNOWN_PLAYER')
  return playerId
}

function ownPlay(playId: string): MockPlay {
  const playerId = currentPlayer()
  const play = plays.get(playId)
  // 다른 사람의 플레이는 존재를 드러내지 않는다 (07 V02)
  if (!play || play.playerId !== playerId) throw new ApiError(404, 'NOT_FOUND')
  return play
}

function validateStart(body: StartPlayRequest): void {
  const missing =
    !body.name?.trim() ||
    !Number.isInteger(body.age) ||
    body.age < 0 ||
    !body.situation?.trim() ||
    typeof body.hasDreamJob !== 'boolean' ||
    (body.hasDreamJob && !body.dreamJob?.trim())
  if (missing) throw new ApiError(400, 'INVALID_INPUT')
}

export const mockGameApi: GameApi = {
  async createPlayer() {
    await wait()
    const playerId = uuid()
    players.add(playerId)
    writeStorage(PLAYERS_KEY, JSON.stringify([...players]))
    return { playerId }
  },

  async startPlay(body) {
    await wait()
    const playerId = currentPlayer()
    validateStart(body)
    const play: MockPlay = {
      playId: uuid(),
      playerId,
      sessionId: uuid(),
      profile: body,
      // 시작값은 docs/game/03-rules.md (자금 50 · 에너지 70)
      state: { age: body.age, elapsedDays: 0, funds: 50, energy: 70 },
      messages: [
        {
          role: 'narrator',
          speaker: '나레이션',
          text: `${body.age}살 ${body.situation} ${body.name}의 하루가 시작됩니다. 창밖으로 봄바람이 불어와요.`,
        },
        { role: 'npc', speaker: '친구 민수', text: `${body.name}, 오늘 방과 후에 뭐 할 거야?` },
      ],
      turn: 0,
      ended: false,
      startedAt: new Date().toISOString(),
    }
    plays.set(play.playId, play)
    return { playId: play.playId, sessionId: play.sessionId, state: { ...play.state }, messages: [...play.messages] }
  },

  async getPlay(playId) {
    await wait()
    const play = ownPlay(playId)
    return { playId: play.playId, sessionId: play.sessionId, state: { ...play.state }, messages: [...play.messages], ended: play.ended }
  },

  async sendTurn(playId, body) {
    await wait()
    const play = ownPlay(playId)
    const message = body.message?.trim()
    if (!message) throw new ApiError(400, 'INVALID_INPUT')
    if (play.ended) throw new ApiError(409, 'ALREADY_ENDED')
    if (message.includes('오류')) throw new ApiError(502, 'AI_UNAVAILABLE')
    if (message.includes('느려')) throw new ApiError(504, 'TIMEOUT')

    play.turn += 1
    const userMessage: ChatMessage = { role: 'user', speaker: play.profile.name, text: message }
    const ended = message.includes('끝')
    const response: TurnResponse = {
      turnId: uuid(),
      messages: [],
      stateChanges: [],
      hints: ['동아리에 대해 물어본다', '오늘은 집에서 쉰다'],
      experience: null,
      ended,
    }

    if (ended) {
      response.messages.push({ role: 'narrator', speaker: '나레이션', text: '긴 시간이 흘러, 이번 인생의 이야기가 막을 내립니다.' })
      response.hints = []
    } else if (message.includes('없는체험')) {
      response.messages.push({ role: 'npc', speaker: '친구 민수', text: '그건 나중에 해 보자!' })
      response.notice = {
        type: 'EXPERIENCE_SKIPPED',
        message: '지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요.',
      }
    } else if (message.includes('체험')) {
      response.messages.push({ role: 'npc', speaker: '선배 지윤', text: '이번 주 축제 준비를 같이 해 볼래? 행사 일정표를 짜는 일이야.' })
      response.experience = {
        buildId: 'career-suite-integration-v005',
        // 개발 서버가 docs/unity/webgl/site 를 이 경로로 제공한다 (vite.config.ts)
        buildUrl: '/local-builds/career-suite-integration-v005/',
        roomId: 'PAN-002',
        scenarioId: 'career-net-951-experience',
        scenarioVersion: 'v002',
        title: '주민 문화행사 준비',
        jobs: ['행사기획자'],
        reason: '선배가 축제 준비를 함께 하자고 제안했어요.',
      }
    } else {
      response.messages.push({ role: 'npc', speaker: '친구 민수', text: `"${message}"? 좋아, 그럼 같이 가 보자!` })
    }

    // 세 턴마다 하루가 지나 나이 계산에 반영되는 흉내 (03-rules.md 의 age = 시작 나이 + floor(elapsedDays / 365) 를 단순화)
    if (play.turn % 3 === 0 && !ended) {
      const from = play.state.age
      play.state.age = from + 1
      response.stateChanges.push({ field: 'age', from, to: play.state.age })
      // 하루 활동: 에너지 -5 (03-rules.md 의 하루 활동 효과, 0 아래로 내려가지 않음)
      const energyFrom = typeof play.state.energy === 'number' ? play.state.energy : 70
      play.state.energy = Math.max(0, energyFrom - 5)
      response.stateChanges.push({ field: 'energy', from: energyFrom, to: play.state.energy })
    }

    play.ended = ended
    play.messages.push(userMessage, ...response.messages)
    return response
  },

  async getResult(playId) {
    await wait()
    const play = ownPlay(playId)
    if (!play.ended) throw new ApiError(409, 'NOT_ENDED')
    return {
      ending: `${play.profile.name}은(는) 여러 사람을 만나며 무언가를 함께 준비하는 일에 즐거움을 느꼈어요.`,
      recommendedJobs: [
        {
          job: '행사기획자',
          isNew: false,
          basis: ['experience', 'conversation'],
          reason: '축제 준비 체험을 끝까지 해냈고, 일정 짜는 일이 재밌다고 말했어요.',
          work: '행사의 목적에 맞게 일정 · 장소 · 인원을 계획하고 진행을 관리해요.',
          nextSteps: ['학교 행사 준비 동아리에 참여해 보기', '작은 모임의 일정표를 직접 짜 보기'],
        },
        {
          job: '사서',
          isNew: true,
          basis: ['interest'],
          reason: '책 이야기에 관심을 보였지만 아직 경험하지 않은 일이에요.',
          work: '자료를 수집 · 정리하고 이용자가 필요한 정보를 찾도록 도와요.',
          nextSteps: ['도서관 봉사활동 알아보기'],
        },
        {
          job: '광고디자이너',
          isNew: true,
          basis: ['conversation'],
          reason: '포스터를 꾸미는 일에 흥미를 보였어요.',
          work: '상품이나 행사를 알리는 시각 자료를 기획하고 디자인해요.',
          nextSteps: ['간단한 포스터 디자인해 보기', '디자인 도구 기초 익히기'],
        },
      ],
    }
  },

  async listMyPlays() {
    await wait()
    const playerId = currentPlayer()
    return {
      plays: [...plays.values()]
        .filter((play) => play.playerId === playerId)
        .map((play) => ({
          playId: play.playId,
          startedAt: play.startedAt,
          ended: play.ended,
          summary: `${play.profile.name} · ${play.state.age}세 · ${play.turn}턴`,
        })),
    }
  },
}
