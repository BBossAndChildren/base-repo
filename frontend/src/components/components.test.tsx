import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, ChipGroup, ErrorScreen, Modal, Segmented, SelectField, TextField, ToastProvider, useToast } from '.'

describe('Button', () => {
  it('loading 이면 누를 수 없고 aria-busy', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        저장
      </Button>,
    )
    const button = screen.getByRole('button', { name: '저장' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('기본 type 은 button (폼 안에서 의도치 않은 제출 방지)', () => {
    render(<Button>확인</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})

describe('TextField · SelectField', () => {
  it('라벨로 찾을 수 있고 오류를 입력칸에 연결한다', () => {
    render(<TextField label="나이" error="7~99 사이로 입력해 주세요." />)
    const input = screen.getByLabelText('나이')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('7~99 사이로 입력해 주세요.')
  })

  it('오류가 없으면 도움말을 설명으로 연결한다', () => {
    render(<TextField label="이름" help="닉네임도 괜찮아요" />)
    expect(screen.getByLabelText('이름')).toHaveAccessibleDescription('닉네임도 괜찮아요')
    expect(screen.getByLabelText('이름')).not.toHaveAttribute('aria-invalid')
  })

  it('선택칸은 보기를 보여 준다', async () => {
    render(<SelectField label="지금 상황" options={['중학생', '직장인']} placeholder="선택" defaultValue="" />)
    const select = screen.getByLabelText('지금 상황')
    await userEvent.selectOptions(select, '직장인')
    expect(select).toHaveValue('직장인')
  })
})

describe('Segmented', () => {
  it('하나만 선택된다', async () => {
    function Wrapper() {
      const [value, setValue] = useState<'yes' | 'no' | null>(null)
      return (
        <Segmented
          label="희망 직업"
          options={[
            { value: 'yes', label: '있어요' },
            { value: 'no', label: '없어요' },
          ]}
          value={value}
          onChange={setValue}
        />
      )
    }
    render(<Wrapper />)
    await userEvent.click(screen.getByLabelText('있어요'))
    expect(screen.getByLabelText('있어요')).toBeChecked()
    await userEvent.click(screen.getByLabelText('없어요'))
    expect(screen.getByLabelText('있어요')).not.toBeChecked()
    expect(screen.getByLabelText('없어요')).toBeChecked()
  })
})

describe('ChipGroup', () => {
  function Wrapper({ max }: { max?: number }) {
    const [selected, setSelected] = useState<string[]>([])
    return <ChipGroup label="관심사" options={['과학', '음악', '운동']} selected={selected} onChange={setSelected} max={max} />
  }

  it('누르면 선택 · 다시 누르면 해제', async () => {
    render(<Wrapper />)
    const chip = screen.getByRole('button', { name: '과학' })
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('최대 개수에 닿으면 나머지는 고를 수 없다', async () => {
    render(<Wrapper max={2} />)
    await userEvent.click(screen.getByRole('button', { name: '과학' }))
    await userEvent.click(screen.getByRole('button', { name: '음악' }))
    expect(screen.getByRole('button', { name: '운동' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '과학' }))
    expect(screen.getByRole('button', { name: '운동' })).toBeEnabled()
  })
})

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function Trigger({ type, durationMs }: { type?: 'info' | 'error'; durationMs?: number }) {
    const toast = useToast()
    return <button onClick={() => toast.show({ type, message: '안내 문구', durationMs })}>보이기</button>
  }

  it('보이고, 닫기 버튼으로 닫힌다', async () => {
    render(
      <ToastProvider>
        <Trigger durationMs={0} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: '보이기' }))
    expect(screen.getByRole('status')).toHaveTextContent('안내 문구')
    await userEvent.click(screen.getByRole('button', { name: '알림 닫기' }))
    expect(screen.queryByText('안내 문구')).not.toBeInTheDocument()
  })

  it('오류 토스트는 alert 역할', async () => {
    render(
      <ToastProvider>
        <Trigger type="error" durationMs={0} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: '보이기' }))
    expect(screen.getByRole('alert')).toHaveTextContent('안내 문구')
  })

  it('정해진 시간이 지나면 자동으로 닫힌다', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger durationMs={5000} />
      </ToastProvider>,
    )
    act(() => {
      screen.getByRole('button', { name: '보이기' }).click()
    })
    expect(screen.getByText('안내 문구')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByText('안내 문구')).not.toBeInTheDocument()
  })

  it('Provider 밖에서 쓰면 알 수 있는 오류', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('ToastProvider')
    spy.mockRestore()
  })
})

describe('Modal', () => {
  it('열리면 대화상자 · 첫 버튼에 포커스, Esc 로 닫힌다', async () => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} title="확인" onClose={() => setOpen(false)} actions={<button onClick={() => setOpen(false)}>확인</button>}>
          <p>내용</p>
        </Modal>
      )
    }
    render(<Wrapper />)
    expect(screen.getByRole('dialog', { name: '확인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '확인' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('onClose 가 없으면 Esc 로 닫히지 않는다 (꼭 확인해야 하는 안내)', async () => {
    render(<Modal open title="중요" actions={<button>확인</button>} />)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Tab 이 모달 밖으로 나가지 않는다', async () => {
    render(
      <>
        <button>밖</button>
        <Modal open title="둘" actions={<><button>하나</button><button>둘째</button></>} />
      </>,
    )
    expect(screen.getByRole('button', { name: '하나' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '둘째' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '하나' })).toHaveFocus()
  })
})

describe('ErrorScreen', () => {
  it('문구와 다시 시도 버튼', async () => {
    const onRetry = vi.fn()
    render(<ErrorScreen message="연결이 끊겼어요." onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('연결이 끊겼어요.')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
