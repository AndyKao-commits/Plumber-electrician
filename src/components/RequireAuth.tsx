import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'

const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect'

export function rememberPostLoginRedirect(path: string) {
  if (!path || path === '/login') return
  try {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path)
  } catch {
    /* ignore */
  }
}

export function peekPostLoginRedirect(): string | null {
  try {
    const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    return value && value !== '/login' ? value : null
  } catch {
    return null
  }
}

export function clearPostLoginRedirect() {
  try {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
  } catch {
    /* ignore */
  }
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useUser()
  const location = useLocation()

  if (isLoading) {
    return <div className="empty">載入中…</div>
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`
    rememberPostLoginRedirect(from)
    return <Navigate to="/login" replace state={{ from }} />
  }

  return children
}
