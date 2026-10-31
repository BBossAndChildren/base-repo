import { useCallback, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useToast } from '../../components'
import { env } from '../../lib/env'
import { markIntroSeen, skipIntroThisVisit } from '../../lib/introSeen'
import { CareerIntro } from './CareerIntro'
import './intro.css'

export const INTRO_FAILED_MESSAGE = '인트로를 불러오지 못해 시작 화면으로 이동해요.'

/** 화면 0: 인트로 (FE11, 05-ui-ux.md). 끝나거나 건너뛰면 시작 화면으로 간다 */
export default function IntroPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const left = useRef(false)

  const leave = useCallback(
    (outcome: 'seen' | 'failed') => {
      if (left.current) return
      left.current = true
      if (outcome === 'seen') markIntroSeen()
      else skipIntroThisVisit()
      navigate('/', { replace: true })
    },
    [navigate],
  )

  const handleError = useCallback(() => {
    if (left.current) return
    toast.show({ type: 'info', message: INTRO_FAILED_MESSAGE })
    leave('failed')
  }, [leave, toast])

  // 에셋 주소가 없는 배포에서는 인트로를 띄우지 않는다 (06-deployment.md 5-2-1)
  if (env.introAssetBase === null) return <Navigate to="/" replace />

  return (
    <div className="intro-page">
      <CareerIntro key={env.introAssetBase} assetBase={env.introAssetBase} onComplete={() => leave('seen')} onError={handleError} />
      <button type="button" className="intro-skip" onClick={() => leave('seen')}>
        건너뛰기
      </button>
    </div>
  )
}
