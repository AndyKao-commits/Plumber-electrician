import { useState } from 'react'
import {
  PETTY_CASH_STATUS_LABELS,
  canApprovePettyCashTopUp,
  canDisbursePettyCash,
} from '@/domain/pettyCash'
import { usePettyCash } from '@/hooks/usePettyCash'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function PettyCashPage() {
  const { user } = useUser()
  const {
    accounts,
    requests,
    ledger,
    requestTopUp,
    isRequesting,
    requestError,
    approve,
    isApproving,
    reject,
    isRejecting,
    disburse,
    isDisbursing,
    disburseError,
  } = usePettyCash(user?.id)
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('1000')
  const [reason, setReason] = useState('')

  const selectedAccountId =
    accountId && accounts.some((a) => a.id === accountId)
      ? accountId
      : (accounts[0]?.id ?? '')

  const canApprove = user ? canApprovePettyCashTopUp(user.role) : false
  const canDisburse = user ? canDisbursePettyCash(user.role) : false

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>零用金補充（PET-001）</strong>
        <p className="muted" style={{ margin: 0 }}>
          申請 → Owner 核准 → 撥款入帳為三個獨立事件；核准不等於已撥款。
        </p>
      </section>

      <section className="panel stack">
        <strong>帳戶餘額</strong>
        {accounts.length === 0 ? <div className="empty">尚無帳戶</div> : null}
        {accounts.map((a) => (
          <div key={a.id} className="site-link">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{a.label}</h3>
              <strong>NT${a.balance.toLocaleString()}</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              更新 {formatTaipei(a.updatedAt, 'MM/dd HH:mm')}
            </p>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <strong>申請補充</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedAccountId) return
            void requestTopUp({
              accountId: selectedAccountId,
              amount: Number(amount) || 0,
              reason,
            }).then(() => setReason(''))
          }}
        >
          <div className="field">
            <label htmlFor="pca">帳戶</label>
            <select
              id="pca"
              value={selectedAccountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={accounts.length === 0}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pca-amt">金額</label>
              <input
                id="pca-amt"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pca-reason">原因</label>
              <input
                id="pca-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>
          {requestError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(requestError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel btn-block"
            type="submit"
            disabled={isRequesting || accounts.length === 0}
          >
            {isRequesting ? '送出中…' : '送出補充申請'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>申請清單</strong>
        {requests.length === 0 ? <div className="empty">尚無申請</div> : null}
        {requests.map((r) => {
          const account = accounts.find((a) => a.id === r.accountId)
          return (
            <div key={r.id} className="site-link stack">
              <div className="row between">
                <strong>NT${r.amount.toLocaleString()}</strong>
                <span className="badge">
                  {PETTY_CASH_STATUS_LABELS[r.status]}
                </span>
              </div>
              <p style={{ margin: 0 }}>
                {account?.label || r.accountId} · {r.reason}
              </p>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {formatTaipei(r.requestedAt, 'MM/dd HH:mm')}
              </p>
              {r.status === 'pending_approval' && canApprove ? (
                <div className="row">
                  <button
                    className="btn btn-steel"
                    type="button"
                    disabled={isApproving}
                    onClick={() => void approve(r.id)}
                  >
                    核准
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={isRejecting}
                    onClick={() =>
                      void reject({ requestId: r.id, reason: '駁回' })
                    }
                  >
                    駁回
                  </button>
                </div>
              ) : null}
              {r.status === 'approved' && canDisburse ? (
                <button
                  className="btn btn-steel"
                  type="button"
                  disabled={isDisbursing}
                  onClick={() => void disburse({ requestId: r.id })}
                >
                  {isDisbursing ? '撥款中…' : '撥款入帳'}
                </button>
              ) : null}
            </div>
          )
        })}
        {disburseError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {(disburseError as Error).message}
          </p>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>入帳流水</strong>
        {ledger.length === 0 ? (
          <div className="empty">尚無撥款入帳</div>
        ) : (
          ledger.slice(0, 20).map((e) => (
            <div key={e.id} className="row between">
              <span>
                +NT${e.amount.toLocaleString()} · 餘額{' '}
                {e.balanceAfter.toLocaleString()}
              </span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {formatTaipei(e.postedAt, 'MM/dd HH:mm')}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
