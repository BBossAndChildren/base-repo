import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  children?: ReactNode
  /** 아래 버튼 영역 */
  actions: ReactNode
  /** 위에 보여 줄 아이콘 (예: "!") */
  icon?: ReactNode
  /** Esc · 바깥 클릭으로 닫을 수 있게 하려면 넘긴다. 꼭 확인해야 하는 안내는 넘기지 않는다 */
  onClose?: () => void
}

/** 진행이 끊기는 안내 · 확인 (05-ui-ux.md 6절). 브라우저 alert/confirm 대신 쓴다 */
export function Modal({ open, title, children, actions, icon, onClose }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const first = dialogRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ;(first ?? dialogRef.current)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose) onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      // 포커스가 모달 밖으로 나가지 않게 한다
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {icon && (
          <div className="modal-icon" aria-hidden="true">
            {icon}
          </div>
        )}
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}
