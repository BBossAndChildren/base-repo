/** 체험이 끝난 방식 — 게임 화면이 대화에 안내를 붙인다 */
export type ExperienceExit = 'completed' | 'aborted' | 'failed' | 'pending' | 'error' | 'skipped'

/** 안내 문구 — docs/development/10-prompt-assembly.md 4-4 · 05 화면 3 */
export const EXPERIENCE_MESSAGES = {
  noMatch: '지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요.',
  loadFailed: '3D 체험을 불러오지 못했어요. 이번 체험은 건너뛰고 텍스트로 이어갈게요.',
  errorBody: '체험 중 문제가 생겨 3D 체험을 종료했어요. 지금까지 한 체험은 저장되었어요. 텍스트 모드로 이어서 진행해 주세요.',
  pending: '체험 기록 확인이 늦어지고 있어요. 텍스트로 이어갈게요.',
  interrupted: '종료 응답을 받지 못해 이전 체험을 중단 처리했어요.',
}
