import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT } from '@/domain/rules'
import { isLikelyLineWebView } from '@/lib/liffApp'

/** Minimal chrome for LINE in-app pages (no bottom tab bar). */
export function LiffFrame({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const inLine = isLikelyLineWebView()

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
    </div>
  )
}
