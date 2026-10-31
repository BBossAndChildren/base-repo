import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensurePlayerId } from '../../api'
import { clearPlayerId } from '../../api/player'
import { ToastProvider } from '../../components'
import { mockControl, mockGameApi } from '../../mocks/mockGameApi'
import { StartForm } from './StartForm'
import type { OptionalField } from './options'

function renderForm(optionalFields: OptionalField[] = ['interests', 'values']) {
  const onStarted = vi.fn()
  render(
    <ToastProvider>
      <StartForm optionalFields={optionalFields} onStarted={onStarted} />
    </ToastProvider>,
  )
  return { onStarted, user: userEvent.setup() }
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이름/), '민준')
  await user.type(screen.getByLabelText(/나이/), '15')
  await user.selectOptions(screen.getByLabelText(/지금 상황/), '중학생')
  await user.click(screen.getByLabelText('아직 없어요'))
}

describe('StartForm', () => {
  beforeEach(async () => {
    mockControl.setDelay(0)
    mockControl.reset()
    clearPlayerId()
    await ensurePlayerId(mockGameApi)
  })

  it('필수 4개가 차기 전에는 시작 버튼이 비활성', async () => {
    const { user } = renderForm()
    const submit = screen.getByRole('button', { name: '인생 시작하기' })
    expect(submit).toBeDisabled()
    await fillRequired(user)
    expect(submit).toBeEnabled()
  })

  it('넘겨준 선택 항목 2개만 보이고 나머지는 없다', () => {
    renderForm(['mbti', 'roleModel'])
    expect(screen.getByRole('region', { name: 'MBTI' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '롤모델' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /관심사/ })).not.toBeInTheDocument()
    // 선택 항목 라벨이 두 번 보이지 않고, 입력칸은 이름으로 찾을 수 있다
    expect(screen.getByRole('combobox', { name: 'MBTI' })).toBeInTheDocument()
  })

  it('칸을 벗어난 뒤에만 오류를 보여 준다', async () => {
    const { user } = renderForm()
    const age = screen.getByLabelText(/나이/)
    await user.type(age, '120')
    expect(screen.queryByText('7~99 사이의 숫자로 입력해 주세요.')).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByText('7~99 사이의 숫자로 입력해 주세요.')).toBeInTheDocument()
  })

  it('희망 직업이 있다고 하면 직업명 칸이 나오고 채워야 시작할 수 있다', async () => {
    const { user } = renderForm()
    await fillRequired(user)
    await user.click(screen.getByLabelText('있어요'))
    const submit = screen.getByRole('button', { name: '인생 시작하기' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText(/어떤 직업인가요/), '요리사')
    expect(submit).toBeEnabled()
  })

  it('관심사는 최대 5개, 직접 입력으로 추가할 수 있다', async () => {
    const { user } = renderForm()
    const group = screen.getByRole('group', { name: '관심사 (최대 5개)' })
    for (const name of ['과학', '음악', '운동', '요리']) await user.click(within(group).getByRole('button', { name }))
    await user.type(screen.getByLabelText('관심사 직접 입력'), '천문학{Enter}')
    expect(within(group).getByRole('button', { name: '천문학' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: '자연·동물' })).toBeDisabled()
  })

  it('건너뛴 선택 항목은 보내지 않고, 답한 항목만 보낸다', async () => {
    const spy = vi.spyOn(mockGameApi, 'startPlay')
    const { user, onStarted } = renderForm(['interests', 'values'])
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: '과학' }))
    await user.click(screen.getByRole('button', { name: '안정' }))
    const valuesRegion = screen.getByRole('region', { name: /^가치관/ })
    await user.click(within(valuesRegion).getByRole('button', { name: '건너뛰기' }))
    expect(within(valuesRegion).getByText(/건너뛰었어요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '인생 시작하기' }))
    expect(spy).toHaveBeenCalledWith({ name: '민준', age: 15, situation: '중학생', hasDreamJob: false, interests: ['과학'] })
    expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ playId: expect.any(String), sessionId: expect.any(String) }))
    spy.mockRestore()
  })

  it('건너뛴 항목은 다시 고를 수 있다', async () => {
    const { user } = renderForm(['values', 'mbti'])
    const region = screen.getByRole('region', { name: /^가치관/ })
    await user.click(within(region).getByRole('button', { name: '건너뛰기' }))
    expect(within(region).queryByRole('button', { name: '안정' })).not.toBeInTheDocument()
    await user.click(within(region).getByRole('button', { name: '다시 고르기' }))
    expect(within(region).getByRole('button', { name: '안정' })).toBeInTheDocument()
  })

  it('서버가 입력 오류를 주면 폼 위에 안내하고 다시 시도할 수 있다', async () => {
    const spy = vi.spyOn(mockGameApi, 'startPlay').mockRejectedValueOnce(Object.assign(new (await import('../../api/errors')).ApiError(400, 'INVALID_INPUT')))
    const { user, onStarted } = renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: '인생 시작하기' }))
    expect(await screen.findByText('입력 내용을 다시 확인해 주세요.')).toBeInTheDocument()
    expect(onStarted).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '인생 시작하기' })).toBeEnabled()
    spy.mockRestore()
  })

  it('AI 서버 오류 등은 토스트로 안내한다', async () => {
    const { ApiError } = await import('../../api/errors')
    const spy = vi.spyOn(mockGameApi, 'startPlay').mockRejectedValueOnce(new ApiError(502, 'AI_UNAVAILABLE'))
    const { user } = renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: '인생 시작하기' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.')
    spy.mockRestore()
  })
})
