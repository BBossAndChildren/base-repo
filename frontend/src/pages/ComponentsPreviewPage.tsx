import { useState } from 'react'
import { Badge, Button, ChipGroup, ErrorScreen, Modal, Segmented, SelectField, Spinner, TextField, TypingIndicator, useToast } from '../components'
import { env } from '../lib/env'

const INTERESTS = ['과학', '기술·IT', '예술·디자인', '음악', '운동', '책·글쓰기', '요리', '사람 돕기', '사업·경제', '자연·동물'] as const
const SITUATIONS = ['초등학생', '중학생', '고등학생', '대학생', '직장인', '구직 중', '기타'] as const

/** 공통 컴포넌트 확인용 임시 화면 (docs/design/README.md 의 역할 변수 확인용). 4단계에서 라우팅으로 대체한다 */
export function ComponentsPreviewPage() {
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [interests, setInterests] = useState<string[]>(['과학'])
  const [dream, setDream] = useState<'yes' | 'no' | null>(null)
  const [name, setName] = useState('')

  return (
    <main className="page-narrow stack">
      <h1>공통 컴포넌트</h1>
      <p className="muted small">API 모드: {env.useMock ? 'mock' : '실제 서버'} · 디자인: docs/design/README.md</p>

      <h2 className="section-title">버튼</h2>
      <div className="row">
        <Button>인생 시작하기</Button>
        <Button variant="secondary">이어하기</Button>
        <Button variant="ghost">건너뛰기</Button>
        <Button variant="danger">새로 시작하기</Button>
        <Button disabled>비활성</Button>
        <Button loading>처리 중</Button>
      </div>

      <h2 className="section-title">입력</h2>
      <TextField label="이름" required placeholder="게임에서 불릴 이름" value={name} onChange={(e) => setName(e.target.value)} help="닉네임도 괜찮아요" />
      <TextField label="나이" required type="number" min={7} max={99} error="7~99 사이의 숫자로 입력해 주세요." />
      <SelectField label="지금 상황" required placeholder="선택해 주세요" options={SITUATIONS} defaultValue="" />
      <Segmented
        label="되고 싶은 직업이 있나요?"
        required
        options={[
          { value: 'yes', label: '있어요' },
          { value: 'no', label: '아직 없어요' },
        ]}
        value={dream}
        onChange={setDream}
      />

      <h2 className="section-title">칩</h2>
      <ChipGroup label="관심사" options={INTERESTS} selected={interests} onChange={setInterests} max={5} />

      <h2 className="section-title">배지</h2>
      <div className="row">
        <Badge tone="new">새로운 일</Badge>
        <Badge tone="success">3D 체험함</Badge>
        <Badge tone="progress">진행 중</Badge>
        <Badge>끝남</Badge>
      </div>

      <h2 className="section-title">토스트 · 모달</h2>
      <div className="row">
        <Button variant="secondary" onClick={() => toast.show({ message: '지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요.' })}>
          안내 토스트
        </Button>
        <Button variant="secondary" onClick={() => toast.show({ type: 'error', message: '잠시 후 다시 시도해 주세요.' })}>
          오류 토스트
        </Button>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          모달
        </Button>
      </div>
      <Modal
        open={modalOpen}
        icon="!"
        title="3D 체험을 종료했어요"
        actions={<Button onClick={() => setModalOpen(false)}>텍스트로 계속하기</Button>}
      >
        <p>체험 중 문제가 생겨 3D 체험을 종료했어요. 지금까지 한 체험은 저장되었어요. 텍스트 모드로 이어서 진행해 주세요.</p>
      </Modal>

      <h2 className="section-title">로딩 · 오류</h2>
      <div className="row">
        <Spinner />
        <TypingIndicator />
      </div>
      <ErrorScreen message="연결이 끊겼어요. 인터넷 연결을 확인해 주세요." onRetry={() => toast.show({ message: '다시 시도했어요' })} />
    </main>
  )
}
