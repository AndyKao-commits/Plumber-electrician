import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import {
  PENDING_LINE_USER_ID_KEY,
  consumeLineBindState,
  getLineBindRedirectUri,
  getLineLoginExchangeUrl,
} from '@/lib/lineLogin'
import { toUserMessage } from '@/lib/errors'

export function LineBindCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, isFormalMode, bindLineUserId, isLoading } = useUser()
  const [status, setStatus] = useState('正在向 LINE 確認身分…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    let cancelled = false

    async function run() {
      try {
        if (!isFormalMode) {
          throw new Error('本機示範模式不支援 LINE Login 綁定')
        }

        const errParam = params.get('error')
        if (errParam) {
          throw new Error(`LINE 授權取消或失敗（${errParam}）`)
        }

        const code = params.get('code')
        const state = params.get('state')
        let lineUserId = sessionStorage.getItem(PENDING_LINE_USER_ID_KEY)

        if (code) {
          if (!consumeLineBindState(state)) {
            throw new Error('授權狀態不符，請回今日團隊重新按「用 LINE 綁定」')
          }

          const anonKey =
            (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
            (import.meta.env.SUPABASE_ANON_KEY as string | undefined) ||
            ''

          const exchangeRes = await fetch(getLineLoginExchangeUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(anonKey
                ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey }
                : {}),
            },
            body: JSON.stringify({
              code,
              redirectUri: getLineBindRedirectUri(),
            }),
          })
          const exchangeJson = (await exchangeRes.json()) as {
            ok?: boolean
            lineUserId?: string
            error?: string
            detail?: string
          }
          if (!exchangeRes.ok || !exchangeJson.ok || !exchangeJson.lineUserId) {
            throw new Error(
              exchangeJson.detail || exchangeJson.error || '無法向 LINE 換取使用者資訊',
            )
          }
          lineUserId = exchangeJson.lineUserId
          sessionStorage.setItem(PENDING_LINE_USER_ID_KEY, lineUserId)
        }

        if (!lineUserId) {
          throw new Error('缺少 LINE 使用者資訊，請重新綁定')
        }

        if (!user) {
          setStatus('請先用 Email／密碼登入，登入後會自動完成綁定')
          navigate('/login', { replace: true })
          return
        }

        setStatus('正在寫入綁定…')
        await bindLineUserId(lineUserId)
        sessionStorage.removeItem(PENDING_LINE_USER_ID_KEY)
        if (cancelled) return
        setStatus('綁定成功！')
        navigate('/team', { replace: true })
      } catch (err) {
        sessionStorage.removeItem(PENDING_LINE_USER_ID_KEY)
        if (cancelled) return
        setError(toUserMessage(err, 'LINE 綁定失敗'))
        setStatus('綁定失敗')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [bindLineUserId, isFormalMode, isLoading, navigate, params, user])

  return (
    <div className="stack fade-up" style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <strong>LINE 綁定</strong>
      <p className="muted" style={{ margin: 0 }}>{status}</p>
      {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
      {error ? (
        <Link to="/team" className="btn btn-steel" style={{ display: 'inline-block', textAlign: 'center' }}>
          回今日團隊
        </Link>
      ) : null}
    </div>
  )
}
