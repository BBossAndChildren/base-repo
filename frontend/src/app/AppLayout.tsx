import { Link, Outlet } from 'react-router'

export function AppLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 바로가기
      </a>
      <header className="site-header">
        <Link className="brand" to="/">
          <svg className="brand-star" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2l2.6 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.6 6.2 20l1.6-6.6L2.6 8.9l6.8-.6z"
              fill="#E9B949"
              stroke="#2B3A67"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          어른왕자
        </Link>
        <nav className="site-nav" aria-label="주요 메뉴">
          <Link to="/intro">인트로 다시 보기</Link>
          <Link to="/history">지난 기록</Link>
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer">게임 속 사건과 인물은 가상이며, 직업 정보는 직업백과를 근거로 합니다. 결과는 실제 진로 · 취업을 보장하지 않습니다.</footer>
    </>
  )
}
