import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { PRODUCT, ROLES } from '@/domain/rules'
import { useUser } from '@/hooks/useUser'
import { isSupabaseConfigured, supabaseUrl } from '@/lib/supabase'

type AuthTab = 'login' | 'signup'

export function LoginPage() {
  const {
    user,
    directory,
    loginAs,
    loginWithPassword,
    signUp,
    isLoggingIn,
    isSigningUp,
    isLoading,
    isDemoMode,
    passwordLoginError,
    signUpError,
  } = useUser()

  const [tab, setTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  async function onPasswordLogin(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    await loginWithPassword({ email, password })
  }

  async function onSignUp(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (password !== confirmPassword) {
      setFormError('兩次密碼不一致')
      return
    }
    if (password.length < 6) {
      setFormError('密碼至少 6 碼')
      return
    }
    await signUp({
      name,
      email,
      password,
      organizationName: organizationName.trim() || null,
    })
  }

  const busy = isLoggingIn || isSigningUp

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
            <strong>
              {isDemoMode
                ? '選擇身分開始'
                : tab === 'login'
                  ? 'Email／密碼登入'
                  : '建立帳號'}
            </strong>
            <span className="badge steel">
              {isDemoMode ? '本機示範模式' : 'Supabase 正式模式'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            專案：{supabaseUrl?.replace(/^https:\/\//, '')}
            {isDemoMode
              ? ' · 尚未設定 anon key，暫用本機示範帳號（正式資料不會寫入）'
              : ' · 已連線；資料僅存於 Supabase'}
          </p>

          {!isDemoMode && isSupabaseConfigured ? (
            <>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${tab === 'login' ? 'btn-steel' : 'btn-ghost'}`}
                  disabled={busy}
                  onClick={() => {
                    setTab('login')
                    setFormError(null)
                  }}
                >
                  登入
                </button>
                <button
                  type="button"
                  className={`btn ${tab === 'signup' ? 'btn-steel' : 'btn-ghost'}`}
                  disabled={busy}
                  onClick={() => {
                    setTab('signup')
                    setFormError(null)
                  }}
                >
                  建立帳號
                </button>
              </div>

              {tab === 'login' ? (
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
                  {formError ? (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
                  ) : null}
                  {passwordLoginError ? (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>
                      {passwordLoginError.message}
                    </p>
                  ) : null}
                  <button className="btn btn-steel btn-block" type="submit" disabled={busy}>
                    {isLoggingIn ? '登入中…' : '登入'}
                  </button>
                </form>
              ) : (
                <form className="stack" onSubmit={(e) => void onSignUp(e)}>
                  <div className="field">
                    <label htmlFor="signup-name">姓名</label>
                    <input
                      id="signup-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例如：師傅阿明"
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-email">Email</label>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-password">密碼（至少 6 碼）</label>
                    <input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-confirm">確認密碼</label>
                    <input
                      id="signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="signup-org">公司名稱（選填）</label>
                    <input
                      id="signup-org"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="留空＝加入既有組織；填寫＝開設新公司"
                    />
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    留空公司名稱：加入系統中既有組織（首位為老闆，之後為員工）。
                    填寫公司名稱：建立新組織，你會成為老闆。
                  </p>
                  {formError ? (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
                  ) : null}
                  {signUpError ? (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>{signUpError.message}</p>
                  ) : null}
                  <button className="btn btn-steel btn-block" type="submit" disabled={busy}>
                    {isSigningUp ? '建立中…' : '建立帳號並進入'}
                  </button>
                </form>
              )}
            </>
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
