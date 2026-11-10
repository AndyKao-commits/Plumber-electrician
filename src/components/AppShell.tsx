import { NavLink, Outlet } from 'react-router-dom'
import { PRODUCT, ROLES } from '@/domain/rules'
import { useNotices } from '@/hooks/useNotices'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'

export function AppShell() {
  const { user, logout } = useUser()
  const { unreadCount } = useNotices(user?.id)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>{PRODUCT.name}</strong>
          <span>
            {user ? `${user.name} · ${ROLES[user.role].label}` : PRODUCT.tagline}
            {' · '}
            {dataModeLabel()}
          </span>
        </div>
        {user ? (
          <div className="row">
            <NavLink to="/notifications" className="btn btn-ghost">
              通知{unreadCount > 0 ? ` ${unreadCount}` : ''}
            </NavLink>
            <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
              登出
            </button>
          </div>
        ) : null}
      </header>

      <Outlet />

      {user ? (
        <nav className="bottom-nav" aria-label="主要導覽">
          <NavLink to="/" end>
            首頁
          </NavLink>
          <NavLink to="/sites">工地</NavLink>
          <NavLink to="/purchases">採購</NavLink>
          <NavLink to="/attendance">出勤</NavLink>
        </nav>
      ) : null}
    </div>
  )
}
