import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { toUserMessage } from '@/lib/errors'
import { isFormalMode } from '@/lib/dataMode'
import { supabaseRepos } from '@/lib/supabaseRepos'

export function ChangePasswordPage() {
  const { user, refetch, isLoading } = useUser()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isLoading) return <div className="empty">載入中…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangePassword) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('新密碼至少 6 碼')
      return
    }
    if (password !== confirm) {
      setError('兩次密碼不一致')
      return
    }
    if (user?.phone && password === user.phone.replace(/\D/g, '')) {
      setError('請勿繼續使用電話當作密碼，請設定新密碼')
      return
    }
    if (user?.loginId && password === user.loginId) {
      setError('請勿繼續使用預設帳號當作密碼，請設定新密碼')
      return
    }
    if (!isFormalMode()) {
      setError('示範模式不支援更改密碼')
      return
    }
    setBusy(true)
    try {
      await supabaseRepos.changeOwnPassword(password)
      await refetch()
    } catch (err) {
      setError(toUserMessage(err, '更改密碼失敗'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card stack fade-up">
        <section className="panel stack">
          <strong>首次登入：請更改密碼</strong>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            請設定個人密碼後才能繼續使用。
          </p>
          <form className="stack" onSubmit={(e) => void onSubmit(e)}>
            <div className="field">
              <label htmlFor="new-password">新密碼（至少 6 碼）</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">確認新密碼</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error ? (
              <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
            ) : null}
            <button className="btn btn-steel btn-block" type="submit" disabled={busy}>
              {busy ? '儲存中…' : '儲存新密碼並進入'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
