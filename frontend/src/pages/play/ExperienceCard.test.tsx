import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ExperienceSuggestion } from '../../types/api'
import { ExperienceCard } from './ExperienceCard'

const suggestion = (basis: ExperienceSuggestion['basis']): ExperienceSuggestion => ({
  buildId: 'b',
  buildUrl: 'https://x/builds/b/',
  roomId: 'PAN-002',
  scenarioId: 's1',
  scenarioVersion: 'v002',
  title: '주민 문화행사 준비',
  jobs: ['행사기획자'],
  reason: '되고 싶다고 한 일을 3D 공간에서 미리 해 봐요.',
  basis,
  job: '행사기획자',
  roomName: '협업·기획 사무실',
  description: '행사 요청서를 정리합니다.',
})

function renderCard(props: Partial<Parameters<typeof ExperienceCard>[0]> = {}) {
  const onStart = vi.fn()
  const onShuffle = vi.fn()
  render(<ExperienceCard suggestion={suggestion('currentJob')} loading={false} failed={false} disabled={false} onStart={onStart} onShuffle={onShuffle} {...props} />)
  return { onStart, onShuffle, card: screen.getByRole('region', { name: '3D 직업 체험' }) }
}

describe('3D 체험 카드 (#171)', () => {
  it('직업 · 근거 배지 · 방 · 업무를 보여 주고 [내 업무 체험하기] 로 시작한다', async () => {
    const { onStart, card } = renderCard()
    expect(within(card).getByText('내 직업')).toBeInTheDocument()
    expect(within(card).getByRole('heading', { name: '행사기획자' })).toBeInTheDocument()
    expect(within(card).getByText('현재 직업')).toBeInTheDocument()
    // 인트로 에셋 주소가 없는 환경에서는 방 이름으로 대신한다
    expect(within(card).getByRole('img', { name: '협업·기획 사무실 3D 공간' })).toHaveTextContent('협업·기획 사무실')
    expect(within(card).getByText('주민 문화행사 준비')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: '내 업무 체험하기' }))
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 's1' }))
  })

  it('근거별 문구: 희망 직업 · 무작위', () => {
    renderCard({ suggestion: suggestion('dreamJob') })
    expect(screen.getByText('희망 직업')).toBeInTheDocument()
  })

  it('다른 체험 고르기 · 3D 공간 보기(설명과 시작 버튼)', async () => {
    const { onShuffle, onStart } = renderCard({ suggestion: suggestion('random') })
    expect(screen.getByText('새로운 일')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다른 체험 고르기' }))
    expect(onShuffle).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '3D 공간 보기 →' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('행사 요청서를 정리합니다.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '내 업무 체험하기' }))
    expect(onStart).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('잠긴 동안에는 시작 · 다시 고르기를 막고, 추천 실패면 다시 시도를 준다', async () => {
    renderCard({ disabled: true })
    expect(screen.getByRole('button', { name: '내 업무 체험하기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다른 체험 고르기' })).toBeDisabled()
  })

  it('추천을 못 받으면 다시 시도', async () => {
    const { onShuffle } = renderCard({ suggestion: null, failed: true })
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onShuffle).toHaveBeenCalled()
  })
})
