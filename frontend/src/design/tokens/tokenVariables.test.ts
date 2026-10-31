import { describe, expect, it } from 'vitest'
import tokens from './tokens.json'
import { toCSSVariables, tokenVariables } from './tokenVariables'

type Node = { value?: unknown; runtime?: boolean; [key: string]: unknown }

function runtimePaths(node: Record<string, unknown>, path: string[] = []): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const next = [...path, key]
    const token = value as Node
    if (Object.hasOwn(token, 'value')) return token.runtime === false ? [] : [next.join('.')]
    return runtimePaths(token, next)
  })
}

describe('디자인 토큰 (docs/design/README.md)', () => {
  it('토큰 경로를 CSS 변수로 바꾸고, 모르는 경로는 오류로 알린다', () => {
    expect(toCSSVariables({ 'semantic.text.primary': '#fff' })).toEqual({ '--ci-semantic-text-primary': '#fff' })
    expect(() => toCSSVariables({ 'semantic.nope': '#fff' } as never)).toThrow('Unknown or build-only design token')
  })

  it('생성 파일이 tokens.json 과 맞는다 (tokens.json 을 고치고 npm run tokens 를 빠뜨리면 실패)', () => {
    expect(Object.keys(tokenVariables).sort()).toEqual(runtimePaths(tokens.tokens).sort())
  })

  it('앱 배경 · Unity 배경색(#101e24)이 토큰의 필름 색과 같다', () => {
    expect(tokens.tokens.primitive.color.filmSurface.value).toBe('#101e24')
  })
})
