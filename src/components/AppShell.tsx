import { NavLink, Outlet } from 'react-router-dom'
import { PRODUCT } from '@/domain/rules'
import { useUser } from '@/hooks/useUser'
import { ROLES } from '@/domain/rules'

export function AppShell() {
  const { user, logout, isDemoMode } = useUser()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>{PRODUCT.name}</strong>
          <span>
            {user ? `${user.name} · ${ROLES[user.role].label}` : PRODUCT.tagline}
            {isDemoMode ? ' · 本機示範' : ''}
          </span>
        </div>
        {user ? (
          <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
            登出
          </button>
        ) : null}
      </header>

      <Outlet />

      {user ? (
        <nav className="bottom-nav" aria-label="主要導覽">
          <NavLink to="/" end>
            首頁
          </NavLink>
          <NavLink to="/sites">工地</NavLink>
          <NavLink to="/attendance">出勤</NavLink>
        </nav>
      ) : null}
    </div>
  )
}
