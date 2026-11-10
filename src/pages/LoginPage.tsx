import { Navigate } from 'react-router-dom'
import { PRODUCT, ROLES } from '@/domain/rules'
import { useUser } from '@/hooks/useUser'

export function LoginPage() {
  const { user, directory, loginAs, isLoggingIn, isLoading, isDemoMode } = useUser()

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-page">
      <div className="login-card stack fade-up">
        <section className="panel hero-panel stack">
          <div className="badge">水電工程行</div>
          <h1>{PRODUCT.name}</h1>
          <p className="lead">
            一鍵打卡、工地紀錄、採購與薪資結算。先快速上班，再補登工地。
          </p>
        </section>

        <section className="panel stack">
          <div className="row between">
            <strong>選擇身分開始</strong>
            <span className="badge steel">{isDemoMode ? '本機示範' : 'Supabase'}</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {isDemoMode
              ? '尚未設定 Supabase，使用本機示範帳號。之後可接上正式登入。'
              : '請使用公司帳號登入。'}
          </p>

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
        </section>
      </div>
    </div>
  )
}
