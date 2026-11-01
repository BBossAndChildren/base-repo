import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../../api'
import { ApiError } from '../../api/errors'
import { clearPlayerId } from '../../api/player'
import { PlayerContext } from '../../app/playerContext'
import { ToastProvider } from '../../components'
import { mockControl, mockGameApi } from '../../mocks/mockGameApi'
import type { PlayResume } from '../../types/api'
import { PlayView } from './PlayView'
import { avatarLetter, declineOpenOffers, type TimelineItem } from './timeline'

async function setup(options: { onStartExperience?: () => void; mapState?: (state: PlayResume['state']) => PlayResume['state']; mapPlay?: (play: PlayResume) => PlayResume } = {}) {
  await ensurePlayerId(mockGameApi)
  const started = await mockGameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
  const resumed: PlayResume = await mockGameApi.getPlay(started.playId)
  const mapped: PlayResume = options.mapState ? { ...resumed, state: options.mapState(resumed.state) } : resumed
  const play: PlayResume = options.mapPlay ? options.mapPlay(mapped) : mapped
  const user = userEvent.setup()
  render(
    <PlayerContext.Provider value={{ playerId: 'p', resetPlayer: vi.fn() }}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/play/${play.playId}`]}>
          <Routes>
            <Route path="/play/:playId" element={<PlayView play={play} onStartExperience={options.onStartExperience} />} />
            <Route path="/play/:playId/result" element={<h1>결말 화면</h1>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </PlayerContext.Provider>,
  )
  // 일시정지로 시작하면 입력칸이 없다
  const input = screen.queryByLabelText('하고 싶은 말이나 행동') as HTMLElement
  const say = async (text: string) => {
    await user.clear(input)
    await user.type(input, text)
    await user.click(screen.getByRole('button', { name: '보내기' }))
  }
  return { play, user, input, say }
}

const log = () => screen.getByRole('list', { name: '대화' })

describe('PlayView', () => {
  beforeEach(() => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
  })

  it('나레이션 · NPC 메시지를 구분하고, 상태 패널에 나이 · 원화 자금 · 빚(0원도) · 건강 · 에너지 · 스트레스를 표시한다', async () => {
    await setup()
    expect(within(log()).getByText('나레이션')).toBeInTheDocument()
    expect(within(log()).getByText('친구 민수')).toBeInTheDocument()
    const panel = screen.getByRole('complementary', { name: '내 상태' })
    expect(within(panel).getByText('15세')).toBeInTheDocument()
    expect(within(panel).getByText('자금').nextElementSibling).toHaveTextContent('0원')
    expect(within(panel).getByText('빚').nextElementSibling).toHaveTextContent('0원')
    expect(within(panel).getByRole('meter', { name: '건강' })).toHaveAttribute('aria-valuenow', '80')
    expect(within(panel).getByRole('meter', { name: '에너지' })).toHaveAttribute('aria-valuenow', '70')
    expect(within(panel).getByRole('meter', { name: '스트레스' })).toHaveAttribute('aria-valuenow', '20')
    // 자금을 0~100 막대로 그리지 않는다 (05 화면 2)
    expect(within(panel).queryByRole('meter', { name: '자금' })).not.toBeInTheDocument()
    // 주거 미배정 · 성적 미확인이면 보이지 않는다
    expect(within(panel).queryByText('주거')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('meter', { name: '성적' })).not.toBeInTheDocument()
  })

  it('원화는 천 단위로, 주거 · 성적은 해당할 때만, 막대 값은 0~100 으로 맞춘다', async () => {
    await setup({
      mapState: (state) => ({
        ...state,
        funds: 1234567,
        debt: 3000000,
        energy: 140,
        housing: { type: 'monthlyRent', deposit: 5000000, depositPaid: true, monthlyRent: 450000, livingCost: 600000 },
        development: { kind: 'grades', value: 72, previousGrades: null },
      }),
    })
    const panel = screen.getByRole('complementary', { name: '내 상태' })
    expect(within(panel).getByText('자금').nextElementSibling).toHaveTextContent('1,234,567원')
    expect(within(panel).getByText('빚').nextElementSibling).toHaveTextContent('3,000,000원')
    expect(within(panel).getByText('주거').nextElementSibling).toHaveTextContent('월세 · 월 1,050,000원')
    expect(within(panel).getByRole('meter', { name: '성적' })).toHaveAttribute('aria-valuenow', '72')
    expect(within(panel).getByRole('meter', { name: '에너지' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('상태 값이 하나도 없으면 자리 표시를 보여 준다', async () => {
    await setup({ mapState: (state) => ({ age: state.age }) })
    const panel = screen.getByRole('complementary', { name: '내 상태' })
    expect(within(panel).getByText('자금 · 건강 · 에너지 (서버 연결 후 표시)')).toBeInTheDocument()
    expect(within(panel).queryByRole('meter')).not.toBeInTheDocument()
  })

  it('첫 장면과 재개 응답의 힌트를 보여 주고, 선택해도 자동으로 보내지 않는다', async () => {
    const spy = vi.spyOn(mockGameApi, 'sendTurn')
    const { user, input } = await setup()
    await user.click(screen.getByRole('button', { name: '방과 후에 할 만한 일을 물어본다' }))
    expect(input).toHaveValue('방과 후에 할 만한 일을 물어본다')
    expect(input).toHaveAccessibleDescription(/보기를 누른 뒤 고쳐 보내도 괜찮아요/)
    expect(screen.getByRole('button', { name: '하루 공부할게' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '하루 쉴게' })).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '다른 활동도 알려줘')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: '다른 활동도 알려줘' })))
    spy.mockRestore()
  })

  it.each([undefined, []])('힌트가 없거나 비어 있으면 막힐 때 쓸 입력 예시를 보여 준다 (%j)', async (hints) => {
    const { user, input } = await setup({
      mapPlay: (play) => ({ ...play, hints, messages: [{ role: 'narrator', speaker: '나레이션', text: '플레이가 시작되었습니다.' }] }),
    })
    expect(screen.getByText('입력 예시')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '하루 공부할게' }))
    expect(input).toHaveValue('하루 공부할게')
    expect(within(log()).queryByText('하루 공부할게')).not.toBeInTheDocument()
  })

  it('보내면 내 말이 오른쪽에 붙고, 응답과 힌트가 온다', async () => {
    const { say } = await setup()
    await say('안녕')
    const mine = within(log()).getByText('안녕').closest('li')
    expect(mine).toHaveClass('msg-user')
    expect(await within(log()).findByText(/"안녕"\? 좋아/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '이렇게 말해 볼 수 있어요' })).toBeInTheDocument()
  })

  it('빈 입력은 보낼 수 없다', async () => {
    const { user, input } = await setup()
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
    await user.type(input, '   ')
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
  })

  it('응답을 기다리는 동안 입력이 잠기고 "생각하는 중…" 을 보여 준다', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof mockGameApi.sendTurn>>) => void
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const { say, input } = await setup()
    await say('기다려')
    expect(input).toBeDisabled()
    expect(screen.getByText('생각하는 중…')).toBeInTheDocument()
    resolve({ turnId: 't', messages: [{ role: 'npc', speaker: '친구 민수', text: '응' }], stateChanges: [], hints: [], experience: null, ended: false })
    await waitFor(() => expect(input).toBeEnabled())
    spy.mockRestore()
  })

  it('힌트를 누르면 입력칸에 채워진다', async () => {
    const { say, input, user } = await setup()
    await say('안녕')
    await user.click(await screen.findByRole('button', { name: '동아리에 대해 물어본다' }))
    expect(input).toHaveValue('동아리에 대해 물어본다')
  })

  it('나이가 바뀌면 상태 패널과 대화에 시간 경과를 보여 준다', async () => {
    const { say } = await setup()
    await say('하나')
    await say('둘')
    await say('셋')
    expect(await within(log()).findByText('시간이 흘렀어요 · 16세')).toBeInTheDocument()
    const panel = screen.getByRole('complementary', { name: '내 상태' })
    expect(within(panel).getByText('16세')).toBeInTheDocument()
    expect(within(panel).getByRole('meter', { name: '에너지' })).toHaveAttribute('aria-valuenow', '65')
  })

  it('오류가 나면 보낸 말을 입력칸에 되돌리고 토스트로 안내한다', async () => {
    const { say, input } = await setup()
    await say('오류')
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.')
    expect(input).toHaveValue('오류')
    expect(within(log()).queryByText('오류')).not.toBeInTheDocument()
  })

  it('전송 대기 중 체험 선택을 잠그고, 실패하면 기존 힌트와 제안을 유지한다', async () => {
    const { say, input, user } = await setup()
    await say('체험 할래')
    await screen.findByRole('button', { name: '체험 시작' })
    let reject!: (error: ApiError) => void
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockReturnValueOnce(new Promise((_resolve, rejectPromise) => (reject = rejectPromise)))
    await say('다른 일을 알아볼래')
    expect(screen.getByRole('button', { name: '체험 시작' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음에 할게요' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '동아리에 대해 물어본다' })).not.toBeInTheDocument()
    reject(new ApiError(504, 'TIMEOUT'))
    await waitFor(() => expect(input).toBeEnabled())
    expect(input).toHaveValue('다른 일을 알아볼래')
    expect(screen.getByRole('button', { name: '동아리에 대해 물어본다' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '체험 시작' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '다음에 할게요' })).toBeEnabled()
    expect(within(log()).queryByText(/체험은 다음에 하기로 했어요/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: '체험 시작' })).not.toBeInTheDocument())
    expect(spy.mock.calls[1][1].requestId).toBe(spy.mock.calls[0][1].requestId)
    spy.mockRestore()
  })

  it('3D 분기면 안내 카드(제목 · 직업 · 이유)를 보여 주고, 체험 시작을 부른다', async () => {
    const onStartExperience = vi.fn()
    const { say } = await setup({ onStartExperience })
    await say('체험 할래')
    const card = await screen.findByRole('listitem', { name: '주민 문화행사 준비' })
    expect(card).toHaveTextContent('행사기획자')
    expect(card).toHaveTextContent('선배가 축제 준비를 함께 하자고 제안했어요.')
    await userEvent.click(within(card).getByRole('button', { name: '체험 시작' }))
    expect(onStartExperience).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'career-net-951-experience' }))
    expect(card).toHaveTextContent('체험하는 중이에요')
  })

  it('[다음에 할게요] 를 누르거나 카드를 두고 계속 말하면 카드가 접힌다', async () => {
    const { say } = await setup()
    await say('체험 할래')
    await userEvent.click(await screen.findByRole('button', { name: '다음에 할게요' }))
    expect(within(log()).getByText(/체험은 다음에 하기로 했어요/)).toBeInTheDocument()

    await say('또 체험')
    expect(await screen.findByRole('button', { name: '체험 시작' })).toBeInTheDocument()
    await say('그냥 집에 갈래')
    await waitFor(() => expect(screen.queryByRole('button', { name: '체험 시작' })).not.toBeInTheDocument())
    expect(within(log()).getAllByText(/체험은 다음에 하기로 했어요/)).toHaveLength(2)
  })

  it('맞는 체험이 없으면 토스트로 안내한다', async () => {
    const { say } = await setup()
    await say('없는체험')
    expect(await screen.findByText('지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요.')).toBeInTheDocument()
  })

  it('인생이 끝나면 입력 대신 [결말 보기] 를 보여 준다', async () => {
    const { say, user } = await setup()
    await say('이제 끝')
    const link = await screen.findByRole('link', { name: '결말 보기' })
    expect(screen.queryByLabelText('하고 싶은 말이나 행동')).not.toBeInTheDocument()
    await user.click(link)
    expect(await screen.findByRole('heading', { name: '결말 화면' })).toBeInTheDocument()
  })

  it('채팅마다 requestId(UUID)를 보내고, 실패한 문장을 그대로 다시 보내면 같은 ID · 고치면 새 ID (05 화면 2)', async () => {
    const spy = vi.spyOn(mockGameApi, 'sendTurn')
    const { say, input, user } = await setup()
    await say('느려')
    expect(await screen.findByText('응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
    expect(input).toHaveValue('느려')
    const first = spy.mock.calls[0][1].requestId
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][1].requestId).toBe(first)
    await say('안녕')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3))
    expect(spy.mock.calls[2][1].requestId).not.toBe(first)
    spy.mockRestore()
  })

  it('자금 부족 선택이 오면 상황과 보기를 보여 주고, 보기를 누르면 입력칸에 채운다 (#134)', async () => {
    const real = mockGameApi.sendTurn.bind(mockGameApi)
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockImplementationOnce(async (playId, body) => ({
      ...(await real(playId, body)),
      pendingChoices: [{ kind: 'insufficientFunds', amount: 200000, options: ['대출 알아보기', '지출 미루기'] }],
    }))
    const { user, input, say } = await setup()
    await say('한 달 지내기')
    const group = await screen.findByRole('group', { name: '선택이 필요해요' })
    expect(within(group).getByText('돈이 200,000원 부족해요. 어떻게 할까요?')).toBeInTheDocument()
    await user.click(within(group).getByRole('button', { name: '지출 미루기' }))
    expect(input).toHaveValue('지출 미루기')
    // 보내면 선택이 사라진다 (다음 턴 응답에 없으므로)
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: '선택이 필요해요' })).not.toBeInTheDocument())
    spy.mockRestore()
  })

  it('주변 인물과의 관계를 이름과 함께 보여 준다 (#145)', async () => {
    await setup({ mapPlay: (play) => ({ ...play, npcs: [{ id: 'minsu', name: '친구 민수' }], state: { ...play.state, relationship: { minsu: 64 } } }) })
    const panel = screen.getByRole('complementary', { name: '내 상태' })
    const people = within(panel).getByRole('region', { name: '주변 인물' })
    expect(within(people).getByRole('meter', { name: '친구 민수' })).toHaveAttribute('aria-valuenow', '64')
  })

  it('시간이 흐른 턴이면 대화에 경과 요약을 보여 준다 (#147)', async () => {
    const real = mockGameApi.sendTurn.bind(mockGameApi)
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockImplementationOnce(async (playId, body) => {
      const turn = await real(playId, body)
      return {
        ...turn,
        stateChanges: [{ field: 'age', from: 15, to: 16 }],
        events: [
          { kind: 'monthlySettlement', facts: {} },
          { kind: 'timePassed', facts: { requestedDays: 365, activity: 'study' } },
        ],
        state: { ...(turn.state ?? { age: 15 }), age: 16, elapsedDays: 365, funds: 700000 },
      }
    })
    const { say } = await setup({ mapState: (state) => ({ ...state, elapsedDays: 0, funds: 100000 }) })
    await say('1년 동안 공부할게')
    expect(await within(log()).findByText('1년 동안 공부하며 시간이 흘렀어요 · 월 정산 1번 · 자금 100,000원 → 700,000원 · 16세')).toBeInTheDocument()
    // 나이 변화는 요약에 들어가므로 따로 "시간이 흘렀어요 · 16세" 를 또 띄우지 않는다
    expect(within(log()).queryByText('시간이 흘렀어요 · 16세')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('재개 응답의 대기 중인 선택도 보여 준다', async () => {
    await setup({ mapPlay: (play) => ({ ...play, hints: [], pendingChoices: [{ kind: 'confirmAdvance', days: 365, activity: 'study', options: ['기간 진행 확인', '기간 변경'] }] }) })
    expect(screen.getByText('약 1년 동안 공부하며 시간을 보낼까요?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '하루 공부할게' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '하루 쉴게' })).not.toBeInTheDocument()
  })

  it('턴 응답의 state 를 확정 값으로 상태 패널에 쓴다', async () => {
    const real = mockGameApi.sendTurn.bind(mockGameApi)
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockImplementationOnce(async (playId, body) => {
      const turn = await real(playId, body)
      return { ...turn, state: { ...(turn.state ?? { age: 15 }), energy: 42 } }
    })
    const { say } = await setup()
    await say('안녕')
    const panel = screen.getByRole('complementary', { name: '내 상태' })
    await waitFor(() => expect(within(panel).getByRole('meter', { name: '에너지' })).toHaveAttribute('aria-valuenow', '42'))
    spy.mockRestore()
  })

  it('STATE_CONFLICT 면 안내 후 대화 · 상태를 다시 조회하고 입력 문장은 남긴다', async () => {
    const getPlay = vi.spyOn(mockGameApi, 'getPlay')
    const { say, input, play } = await setup()
    getPlay.mockClear()
    getPlay.mockResolvedValueOnce({ ...play, hints: ['새 장면에 대해 물어본다'] })
    await say('충돌')
    expect(await screen.findByText('최신 상태를 조회한 뒤 다시 시도해 주세요.')).toBeInTheDocument()
    await waitFor(() => expect(getPlay).toHaveBeenCalledTimes(1))
    expect(input).toHaveValue('충돌')
    expect(screen.getByRole('button', { name: '새 장면에 대해 물어본다' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '방과 후에 할 만한 일을 물어본다' })).not.toBeInTheDocument()
    getPlay.mockRestore()
  })

  it('[일시정지] 하면 입력을 잠그고, [이어 하기] 로 다시 입력할 수 있다 (05 화면 2 · 07 B17)', async () => {
    const spy = vi.spyOn(mockGameApi, 'setPaused')
    const { user, play } = await setup()
    await user.click(screen.getAllByRole('button', { name: '일시정지' })[0])
    expect(await screen.findByText('일시정지 중이에요. 이어 하려면 아래 버튼을 눌러 주세요.')).toBeInTheDocument()
    expect(screen.queryByLabelText('하고 싶은 말이나 행동')).not.toBeInTheDocument()
    expect(spy).toHaveBeenLastCalledWith(play.playId, true)
    expect((await mockGameApi.getPlay(play.playId)).paused).toBe(true)
    await user.click(screen.getByRole('button', { name: '이어 하기' }))
    expect(await screen.findByLabelText('하고 싶은 말이나 행동')).toBeInTheDocument()
    expect(spy).toHaveBeenLastCalledWith(play.playId, false)
    spy.mockRestore()
  })

  it('다시 접속했을 때 재개 응답이 일시정지면 일시정지 화면으로 시작한다', async () => {
    await setup({ mapPlay: (play) => ({ ...play, paused: true }) })
    expect(screen.getByRole('button', { name: '이어 하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '일시정지' })).not.toBeInTheDocument()
  })

  it('보냈는데 PLAY_PAUSED 면 안내하고 일시정지 화면으로 바꾼다 (입력 문장은 유지)', async () => {
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockRejectedValueOnce(new ApiError(409, 'PLAY_PAUSED'))
    const { say } = await setup()
    await say('안녕')
    expect(await screen.findByText('일시정지를 해제해 주세요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이어 하기' })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('채팅 중 네트워크 오류(Cloudflare 가 바꾼 502 · 504)는 응답 지연으로 안내하고, 다시 보내면 같은 requestId (05 5절)', async () => {
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockRejectedValueOnce(new ApiError(0, 'NETWORK'))
    const { say, input, user } = await setup()
    await say('안녕')
    expect(await screen.findByText('응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
    expect(screen.queryByText('연결이 끊겼어요. 인터넷 연결을 확인해 주세요.')).not.toBeInTheDocument()
    expect(input).toHaveValue('안녕')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][1].requestId).toBe(spy.mock.calls[0][1].requestId)
    spy.mockRestore()
  })

  it('이미 끝난 플레이에 보내면 결말 화면으로 간다', async () => {
    const spy = vi.spyOn(mockGameApi, 'sendTurn').mockRejectedValueOnce(new ApiError(409, 'ALREADY_ENDED'))
    const { say } = await setup()
    await say('안녕')
    expect(await screen.findByRole('heading', { name: '결말 화면' })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('timeline helpers', () => {
  it('아바타 글자는 이름의 마지막 단어 첫 글자', () => {
    expect(avatarLetter('친구 민수')).toBe('민')
    expect(avatarLetter('과학 선생님 윤서진')).toBe('윤')
    expect(avatarLetter('')).toBe('?')
  })

  it('대기 중 카드만 접는다', () => {
    const offer = { buildId: 'b', buildUrl: 'u', roomId: 'r', scenarioId: 's', scenarioVersion: 'v', title: 't', jobs: [], reason: '' }
    const items: TimelineItem[] = [
      { kind: 'experience', id: '1', offer, status: 'offered' },
      { kind: 'experience', id: '2', offer, status: 'started' },
    ]
    expect(declineOpenOffers(items).map((item) => (item.kind === 'experience' ? item.status : ''))).toEqual(['declined', 'started'])
  })
})

describe('PlayView + 3D 체험 화면 닫힘', () => {
  beforeEach(() => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
  })

  it('체험 화면을 [다음에 할게요] 로 닫으면 카드가 접히고 안내 메시지는 붙지 않는다', async () => {
    await ensurePlayerId(mockGameApi)
    const started = await mockGameApi.startPlay({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false })
    const play = await mockGameApi.getPlay(started.playId)
    const user = userEvent.setup()
    // 실제 체험 화면을 쓰되, 빌드는 불러오지 못하게 둔다 (jsdom 에는 Unity 가 없다)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    render(
      <PlayerContext.Provider value={{ playerId: 'p', resetPlayer: vi.fn() }}>
        <ToastProvider>
          <MemoryRouter>
            <PlayView play={play} />
          </MemoryRouter>
        </ToastProvider>
      </PlayerContext.Provider>,
    )
    await user.type(screen.getByLabelText('하고 싶은 말이나 행동'), '체험 할래')
    await user.click(screen.getByRole('button', { name: '보내기' }))
    await user.click(await screen.findByRole('button', { name: '체험 시작' }))
    expect(await screen.findByText('3D 체험을 불러오지 못했어요. 이번 체험은 건너뛰고 텍스트로 이어갈게요.')).toBeInTheDocument()
    expect(await within(log()).findByText(/체험은 다음에 하기로 했어요/)).toBeInTheDocument()
    expect(within(log()).queryByText(/이야기로 돌아왔어요/)).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
