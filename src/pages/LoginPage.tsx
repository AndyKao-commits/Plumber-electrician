import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  clearPostLoginRedirect,
  peekPostLoginRedirect,
} from '@/components/RequireAuth'
import { PRODUCT, ROLES } from '@/domain/rules'
import { useUser } from '@/hooks/useUser'
import { isSupabaseConfigured } from '@/lib/supabase'

export function LoginPage() {
  const {
    user,
    directory,
    loginAs,
    loginWithPassword,
    isLoggingIn,
    isLoading,
    isDemoMode,
    passwordLoginError,
  } = useUser()

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const location = useLocation()
  const fromState =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? String((location.state as { from: string }).from)
      : null

  if (!isLoading && user) {
    if (user.mustChangePassword) {
      return <Navigate to="/change-password" replace />
    }
    const pendingLineBind =
      typeof sessionStorage !== 'undefined' &&
      Boolean(sessionStorage.getItem('line_bind_pending_user_id'))
    const redirectTo =
      (fromState && fromState !== '/login' ? fromState : null) ||
      peekPostLoginRedirect() ||
      '/'
    clearPostLoginRedirect()
    return (
      <Navigate
        to={pendingLineBind ? '/line-bind-callback' : redirectTo || '/'}
        replace
      />
    )
  }

  async function onPasswordLogin(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    await loginWithPassword({ account, password })
  }

  return (
    <div className="login-page">
      <div className="login-card stack fade-up">
        <section className="panel hero-panel stack">
          <h1>{PRODUCT.name}</h1>
        </section>

        <section className="panel stack">
          <strong>{isDemoMode ? '選擇身分開始' : '帳號／密碼登入'}</strong>
          {isDemoMode ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              本機示範（未連線正式資料庫）
            </p>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              帳號由管理者開通。預設帳號與密碼為電話；首次登入需更改密碼。
            </p>
          )}

          {!isDemoMode && isSupabaseConfigured ? (
            <form className="stack" onSubmit={(e) => void onPasswordLogin(e)}>
              <div className="field">
                <label htmlFor="login-account">帳號（電話）</label>
                <input
                  id="login-account"
                  type="text"
                  inputMode="tel"
                  autoComplete="username"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="例如：0912345678"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">密碼</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {formError ? (
                <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
              ) : null}
              {passwordLoginError ? (
                <p style={{ color: 'var(--danger)', margin: 0 }}>
                  {passwordLoginError.message}
                </p>
              ) : null}
              <button className="btn btn-steel btn-block" type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? '登入中…' : '登入'}
              </button>
            </form>
          ) : (
            <div className="stack">
              {directory.map((accountOption) => (
                <button
                  key={accountOption.id}
                  type="button"
                  className="account-option"
                  disabled={isLoggingIn}
                  onClick={() => void loginAs(accountOption.id)}
                >
                  <div>
                    <strong>{accountOption.name}</strong>
                    <span>{ROLES[accountOption.role].label}</span>
                  </div>
                  <span className="badge">
                    {accountOption.role === 'boss' ? '管理' : '現場'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
