import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Composer } from './Composer'

const props = { value: '', onChange: vi.fn(), onSubmit: vi.fn(), hints: [], disabled: false, waiting: false }

it('질문형 서버 힌트와 별도로 행동 예시 두 개를 표시하고 클릭은 입력만 바꾼다', async () => {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  render(<Composer {...props} hints={['어떤 일을 해보고 싶은데?']} onChange={onChange} onSubmit={onSubmit} />)
  expect(within(screen.getByRole('group', { name: '이렇게 말해 볼 수 있어요' })).getByRole('button', { name: '어떤 일을 해보고 싶은데?' })).toBeInTheDocument()
  const examples = screen.getByRole('group', { name: '입력 예시' })
  expect(within(examples).getAllByRole('button')).toHaveLength(2)
  await userEvent.click(within(examples).getByRole('button', { name: '하루 공부할게' }))
  expect(onChange).toHaveBeenCalledWith('하루 공부할게')
  await userEvent.click(within(examples).getByRole('button', { name: '하루 쉴게' }))
  expect(onChange).toHaveBeenLastCalledWith('하루 쉴게')
  expect(onSubmit).not.toHaveBeenCalled()
})

it('서버 힌트와 입력 예시의 같은 문구는 한 번만 보여 준다', () => {
  render(<Composer {...props} hints={['하루 공부할게', ' 하루 공부할게 ', '질문', '질문']} />)
  expect(screen.getAllByRole('button', { name: '하루 공부할게' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: '질문' })).toHaveLength(1)
  expect(within(screen.getByRole('group', { name: '입력 예시' })).getAllByRole('button')).toHaveLength(2)
})

it('대기 선택이 있으면 확인·변경 옵션만 보여 다른 행동을 유도하지 않는다', () => {
  render(<Composer {...props} hints={['새로운 체험을 해보자']} choices={[{ kind: 'confirmAdvance', days: 30, activity: 'study', options: ['진행할게', '기간을 바꿀래'] }]} />)
  expect(within(screen.getByRole('group', { name: '선택이 필요해요' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['진행할게', '기간을 바꿀래'])
  expect(screen.queryByRole('group', { name: '입력 예시' })).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: '이렇게 말해 볼 수 있어요' })).not.toBeInTheDocument()
})

it('완료 뒤 전달받은 회고 예시는 기본 행동 예시 대신 유지한다', () => {
  render(<Composer {...props} hints={['이후 계획을 말해줘']} inputExamples={['방금 체험한 내용에 대해 이야기하고 싶어', '다른 활동도 알아보고 싶어']} />)
  const examples = screen.getByRole('group', { name: '입력 예시' })
  expect(within(examples).getAllByRole('button').map((button) => button.textContent)).toEqual(['방금 체험한 내용에 대해 이야기하고 싶어', '다른 활동도 알아보고 싶어'])
  expect(screen.queryByRole('button', { name: '하루 공부할게' })).not.toBeInTheDocument()
})

it('응답 대기 중에는 힌트와 입력 예시를 숨긴다', () => {
  render(<Composer {...props} hints={['질문']} disabled waiting />)
  expect(screen.queryByRole('group', { name: '입력 예시' })).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: '이렇게 말해 볼 수 있어요' })).not.toBeInTheDocument()
})
