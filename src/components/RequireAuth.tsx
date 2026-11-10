import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser()
  const location = useLocation()

  if (isLoading) {
    return <div className="empty">載入中…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
