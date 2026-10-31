import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Modal, Spinner } from '../components'
import { useResumablePlay } from '../hooks/useResumablePlay'
import { clearLastPlayId } from '../lib/lastPlay'

/** 화면 1: 시작 (05-ui-ux.md). 시작 입력 폼은 5단계에서 채운다 */
export function StartPage() {
  const { play, checking } = useResumablePlay()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [startingNew, setStartingNew] = useState(false)
  const showResume = play !== null && !startingNew

  return (
    <div className="page-narrow">
      <section className="hero">
        <h1>어른왕자</h1>
        <p>수많은 인생을 살아 보며, 내가 원하는 삶과 일을 찾아봐요.</p>
      </section>

      {checking && <Spinner label="진행 중인 인생을 확인하는 중" />}

      {showResume && (
        <section className="card resume-card" aria-labelledby="resume-title">
          <div>
            <h2 id="resume-title">진행 중인 인생이 있어요</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {play.state.age}세 · 대화 {play.messages.length}개
            </p>
          </div>
          <div className="row">
            <Link className="btn btn-primary" to={`/play/${play.playId}`}>
              이어하기
            </Link>
            <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
              새로 시작하기
            </Button>
          </div>
        </section>
      )}

      {!checking && !showResume && (
        <section className="card" aria-label="새 인생 시작">
          {/* 5단계: 시작 입력 폼 (필수 4개 + 선택 랜덤 2개) */}
          <p className="muted">시작 입력 화면을 준비하고 있어요.</p>
        </section>
      )}

      <Modal
        open={confirmOpen}
        title="새 인생을 시작할까요?"
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                // 이전 플레이는 끝내지 않는다. 지난 기록에서 이어 할 수 있다 (03 1-2)
                clearLastPlayId()
                setStartingNew(true)
                setConfirmOpen(false)
              }}
            >
              새로 시작하기
            </Button>
          </>
        }
      >
        <p>진행 중인 인생은 지난 기록에 남아요.</p>
      </Modal>
    </div>
  )
}
