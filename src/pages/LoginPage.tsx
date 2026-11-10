import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { PRODUCT, ROLES } from '@/domain/rules'
import { useUser } from '@/hooks/useUser'
import { isSupabaseConfigured, supabaseUrl } from '@/lib/supabase'

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

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  async function onPasswordLogin(event: FormEvent) {
    event.preventDefault()
    await loginWithPassword({ email, password })
  }

  return (
    <div className="login-page">
      <div className="login-card stack fade-up">
        <section className="panel hero-panel stack">
          <div className="badge">水電工程行</div>
          <h1>{PRODUCT.name}</h1>
          <p className="lead">
            一鍵打卡、工地紀錄、採購與系統內通知。全員工程權限相同，敏感財務另保護。
          </p>
        </section>

        <section className="panel stack">
          <div className="row between">
            <strong>{isDemoMode ? '選擇身分開始' : 'Email／密碼登入'}</strong>
            <span className="badge steel">
              {isDemoMode ? '本機示範模式' : 'Supabase 正式模式'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            專案：{supabaseUrl?.replace(/^https:\/\//, '')}
            {isDemoMode
              ? ' · 尚未設定 anon key，暫用本機示範帳號（正式資料不會寫入）'
              : ' · 已連線，請用公司 Email／密碼登入；資料僅存於 Supabase'}
          </p>

          {!isDemoMode && isSupabaseConfigured ? (
            <form className="stack" onSubmit={(e) => void onPasswordLogin(e)}>
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              {passwordLoginError ? (
                <p style={{ color: 'var(--danger)', margin: 0 }}>
                  {(passwordLoginError as Error).message}
                </p>
              ) : null}
              <button className="btn btn-steel btn-block" type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? '登入中…' : '登入'}
              </button>
            </form>
          ) : (
            <div className="stack">
              {directory.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="account-option"
                  disabled={isLoggingIn}
                  onClick={() => void loginAs(account.id)}
                >
                  <div>
                    <strong>{account.name}</strong>
                    <span>{ROLES[account.role].label}</span>
                  </div>
                  <span className="badge">{account.role === 'boss' ? '管理' : '現場'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
