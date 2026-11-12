import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT } from '@/domain/rules'
import {
  closeLiffWindow,
  ensureLiffReady,
  isLiffConfigured,
  isLikelyLineWebView,
  type LiffEntry,
} from '@/lib/liffApp'

/** Minimal chrome for LINE in-app pages (no bottom tab bar). */
export function LiffFrame({
  title,
  children,
  showClose = true,
  liffEntry = 'hub',
}: {
  title: string
  children: ReactNode
  showClose?: boolean
  /** Which LIFF id to init (attendance / location dedicated apps). */
  liffEntry?: LiffEntry
}) {
  const inLine = isLikelyLineWebView()
  const [liffReady, setLiffReady] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeHint, setCloseHint] = useState<string | null>(null)

  useEffect(() => {
    if (!isLiffConfigured(liffEntry)) return
    let cancelled = false
    void ensureLiffReady(liffEntry).then((ok) => {
      if (!cancelled) setLiffReady(ok)
    })
    return () => {
      cancelled = true
    }
  }, [liffEntry])

  async function onClose() {
    setClosing(true)
    setCloseHint(null)
    const result = await closeLiffWindow(liffEntry)
    if (!result.ok) {
      setCloseHint(result.reason ?? '無法關閉')
      setClosing(false)
    }
  }

  return (
    <div className="liff-shell">
      <header className="liff-top">
        <div>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            {PRODUCT.name}
            {inLine ? ' · LINE' : ''}
          </p>
          <strong style={{ fontSize: '1.15rem' }}>{title}</strong>
        </div>
        {!inLine ? (
          <Link to="/" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
            完整版
          </Link>
        ) : null}
      </header>
      <main className="liff-main stack">{children}</main>
      {showClose ? (
        <div className="stack" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-steel"
            style={{ width: '100%' }}
            disabled={closing}
            onClick={() => void onClose()}
          >
            {closing ? '關閉中…' : liffReady ? '關閉回聊天室' : '關閉／返回聊天室'}
          </button>
          {closeHint ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {closeHint}
            </p>
          ) : !isLiffConfigured(liffEntry) && inLine ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              尚未設定 LIFF ID 時，請用 LINE 左上角返回聊天室。
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
