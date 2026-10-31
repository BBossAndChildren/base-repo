// 시작 입력 보기 — 기준: docs/development/03-api.md 1-2 표
export const AGE_MIN = 7
export const AGE_MAX = 99
export const NAME_MAX = 20

export const SITUATIONS = ['초등학생', '중학생', '고등학생', '대학생', '직장인', '구직 중', '기타'] as const
export const INTERESTS = ['과학', '기술·IT', '예술·디자인', '음악', '운동', '책·글쓰기', '요리', '사람 돕기', '사업·경제', '자연·동물'] as const
export const VALUES = ['안정', '성장', '돈', '사회 기여', '자유', '인정', '관계'] as const
export const GENDERS = ['여성', '남성', '선택 안 함'] as const
export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const

export const MAX_INTERESTS = 5
export const MAX_STRENGTHS = 5
export const MAX_VALUES = 3

/** 선택 항목 7개 (03 1-2). 시작 화면에는 이 중 랜덤 2개만 보여 준다 */
export const OPTIONAL_FIELDS = ['gender', 'interests', 'majorOrGrade', 'strengths', 'values', 'roleModel', 'mbti'] as const
export type OptionalField = (typeof OPTIONAL_FIELDS)[number]

export const OPTIONAL_LABELS: Record<OptionalField, string> = {
  gender: '성별',
  interests: '관심사',
  majorOrGrade: '전공 · 학년',
  strengths: '잘하는 것 · 좋아하는 과목',
  values: '가치관',
  roleModel: '롤모델',
  mbti: 'MBTI',
}

/** 선택 항목 중 count 개를 무작위로 고른다 (화면에 보이는 순서는 OPTIONAL_FIELDS 순서) */
export function pickOptionalFields(count = 2, random: () => number = Math.random): OptionalField[] {
  const pool = [...OPTIONAL_FIELDS]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const picked = new Set(pool.slice(0, count))
  return OPTIONAL_FIELDS.filter((field) => picked.has(field))
}
