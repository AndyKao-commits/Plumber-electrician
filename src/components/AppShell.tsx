import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearPostLoginRedirect } from '@/components/RequireAuth'
import { FEATURE_FLAGS, PRODUCT, ROLES } from '@/domain/rules'
import { useNotices } from '@/hooks/useNotices'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useUser } from '@/hooks/useUser'

export function AppShell() {
  const navigate = useNavigate()
  const { user, logout, isLoggingOut } = useUser()
  const { unreadCount } = useNotices(user?.id)
  const { online, pendingCount, flush, flushing } = useOfflineQueue()
  const showOffline = FEATURE_FLAGS.offlineFirst && user && (!online || pendingCount > 0)

  async function onLogout() {
    clearPostLoginRedirect()
    try {
      await logout()
    } finally {
      clearPostLoginRedirect()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>{PRODUCT.name}</strong>
          {user ? (
            <span>
              {user.name} · {ROLES[user.role].label}
            </span>
          ) : null}
        </div>
        {user ? (
          <div className="row">
            <NavLink to="/notifications" className="btn btn-ghost">
              通知{unreadCount > 0 ? ` ${unreadCount}` : ''}
            </NavLink>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={isLoggingOut}
              onClick={() => void onLogout()}
            >
              {isLoggingOut ? '登出中…' : '登出'}
            </button>
          </div>
        ) : null}
      </header>

      {showOffline ? (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <strong style={{ fontSize: 14 }}>
              {!online ? '目前離線' : '有待同步草稿'}
            </strong>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              {!online
                ? '請連線後再同步草稿。'
                : `${pendingCount} 筆將在連線時自動同步。`}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {online && pendingCount > 0 ? (
              <button
                type="button"
                className="btn btn-steel"
                disabled={flushing}
                onClick={() => void flush()}
              >
                {flushing ? '同步中' : '同步'}
              </button>
            ) : null}
            <NavLink to="/offline-queue" className="btn btn-ghost">
              佇列
            </NavLink>
          </div>
        </div>
      ) : null}

      <Outlet />

      {user ? (
        <nav className="bottom-nav" aria-label="主要導覽">
          <NavLink to="/" end>
            首頁
          </NavLink>
          <NavLink to="/sites">工地</NavLink>
          <NavLink to="/expenses">收支</NavLink>
          <NavLink to="/attendance">出勤</NavLink>
          <NavLink to="/more">更多</NavLink>
        </nav>
      ) : null}
    </div>
  )
}
