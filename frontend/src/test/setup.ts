import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// 전체 테스트를 함께 돌리면 jsdom 환경 여러 개가 동시에 떠서 느려진다.
// findBy · waitFor 기본 대기(1초)를 넘겨 간헐 실패하던 것을 막는다 (#151)
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
})
