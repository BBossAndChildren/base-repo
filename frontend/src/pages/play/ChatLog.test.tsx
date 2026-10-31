import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatLog } from './ChatLog'
import type { TimelineItem } from './timeline'

const noop = () => {}

function npc(id: string, text: string): TimelineItem {
  return { kind: 'message', id, message: { role: 'npc', speaker: '민수', text } }
}

function user(id: string, text: string): TimelineItem {
  return { kind: 'message', id, message: { role: 'user', speaker: '나', text } }
}

/** jsdom 에는 레이아웃이 없어 스크롤 크기를 직접 정한다 */
function fakeScrollBox(element: HTMLElement, { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => clientHeight })
}

function renderLog(items: TimelineItem[]) {
  const view = render(<ChatLog items={items} waiting={false} onStartExperience={noop} onDeclineExperience={noop} />)
  const log = screen.getByRole('list', { name: '대화' })
  return { ...view, log, update: (next: TimelineItem[]) => view.rerender(<ChatLog items={next} waiting={false} onStartExperience={noop} onDeclineExperience={noop} />) }
}

describe('ChatLog 내부 스크롤 (#128)', () => {
  it('맨 아래를 보고 있으면 새 메시지를 따라 대화 목록 안에서 내려간다', () => {
    const items = [npc('a', '안녕')]
    const { log, update } = renderLog(items)
    fakeScrollBox(log, { scrollHeight: 1000, clientHeight: 400 })
    update([...items, npc('b', '반가워')])
    expect(log.scrollTop).toBe(1000)
  })

  it('위쪽 대화를 읽는 중이면 새 NPC 메시지가 와도 끌어내리지 않는다', () => {
    const items = [npc('a', '안녕')]
    const { log, update } = renderLog(items)
    fakeScrollBox(log, { scrollHeight: 1000, clientHeight: 400 })
    log.scrollTop = 100
    fireEvent.scroll(log)
    update([...items, npc('b', '반가워')])
    expect(log.scrollTop).toBe(100)
  })

  it('내가 보낸 말은 위를 읽던 중이어도 맨 아래로 보여 준다', () => {
    const items = [npc('a', '안녕')]
    const { log, update } = renderLog(items)
    fakeScrollBox(log, { scrollHeight: 1000, clientHeight: 400 })
    log.scrollTop = 100
    fireEvent.scroll(log)
    update([...items, user('b', '나도 반가워')])
    expect(log.scrollTop).toBe(1000)
  })

  it('대화 목록은 키보드로 스크롤할 수 있게 초점을 받는다', () => {
    const { log } = renderLog([npc('a', '안녕')])
    expect(log.tabIndex).toBe(0)
  })
})
