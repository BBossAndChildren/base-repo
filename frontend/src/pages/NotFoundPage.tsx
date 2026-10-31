import { Link } from 'react-router'
import { ErrorScreen } from '../components'

export function NotFoundPage() {
  return (
    <ErrorScreen
      title="페이지를 찾을 수 없어요"
      message="주소를 다시 확인해 주세요."
      action={
        <Link className="btn btn-secondary" to="/">
          시작 화면으로
        </Link>
      }
    />
  )
}
