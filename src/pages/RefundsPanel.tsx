import { useMemo, useState, type FormEvent } from 'react'
import { effectiveContractAmountWithChangeOrders } from '@/domain/changeOrders'
import { PAYMENT_METHOD_LABELS } from '@/domain/payments'
import {
  balanceReconciliation,
  canIssueCreditOrRefund,
  canManageRefunds,
} from '@/domain/refunds'
import type {
  BillingDocument,
  ChangeOrder,
  CustomerCreditNote,
  CustomerPayment,
  CustomerRefund,
  PaymentMethod,
  Quotation,
} from '@/domain/types'
import { formatTaipei } from '@/lib/time'

type Props = {
  quote: Quotation
  changeOrders: ChangeOrder[]
  billingDocuments: BillingDocument[]
  payments: CustomerPayment[]
  creditNotes: CustomerCreditNote[]
  refunds: CustomerRefund[]
  userRole: string
  saving: boolean
  createCustomerCreditNote: (input: {
    amount: number
    reason: string
    billingDocumentId?: string | null
  }) => Promise<CustomerCreditNote>
  createCustomerRefund: (input: {
    paymentId: string
    amount: number
    method: PaymentMethod
    reason: string
  }) => Promise<CustomerRefund>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function RefundsPanel({
  quote,
  changeOrders,
  billingDocuments,
  payments,
  creditNotes,
  refunds,
  userRole,
  saving,
  createCustomerCreditNote,
  createCustomerRefund,
  onError,
  onSuccess,
}: Props) {
  const canManage = canManageRefunds(userRole)
  const gate = canIssueCreditOrRefund(quote)
  const contract = useMemo(
    () =>
      effectiveContractAmountWithChangeOrders({
        quotes: [quote],
        changeOrders,
      }),
    [quote, changeOrders],
  )
  const bal = useMemo(
    () =>
      balanceReconciliation({
        contract,
        billingDocuments,
        payments,
        creditNotes,
        refunds,
      }),
    [contract, billingDocuments, payments, creditNotes, refunds],
  )

  const confirmedPays = payments.filter((p) => p.status === 'confirmed')
  const [creditAmt, setCreditAmt] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [refundPayId, setRefundPayId] = useState('')
  const [refundAmt, setRefundAmt] = useState('')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('transfer')
  const [refundReason, setRefundReason] = useState('')

  const selectedPay =
    refundPayId && confirmedPays.some((p) => p.id === refundPayId)
      ? refundPayId
      : (confirmedPays[0]?.id ?? '')

  async function onCredit(e: FormEvent) {
    e.preventDefault()
    try {
      await createCustomerCreditNote({
        amount: Number(creditAmt) || 0,
        reason: creditReason,
      })
      setCreditAmt('')
      setCreditReason('')
      onSuccess('已開立折讓（減應收，非現金流出；原請款保留）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '折讓失敗')
    }
  }

  async function onRefund(e: FormEvent) {
    e.preventDefault()
    try {
      await createCustomerRefund({
        paymentId: selectedPay,
        amount: Number(refundAmt) || 0,
        method: refundMethod,
        reason: refundReason,
      })
      setRefundAmt('')
      setRefundReason('')
      onSuccess('已登錄退款（原收款紀錄保留）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '退款失敗')
    }
  }

  return (
    <section className="panel stack">
      <strong>折讓／退款與餘額核對</strong>
      {quote.workflowStatus === 'accepted' ? (
        <p style={{ margin: 0 }}>
          合約 NT${bal.contract.toLocaleString()}
          <br />
          已請款 NT${bal.billed.toLocaleString()} − 折讓 NT$
          {bal.credited.toLocaleString()} ＝ 淨應收 NT$
          {bal.netReceivable.toLocaleString()}
          <br />
          現金進 NT${bal.cashIn.toLocaleString()} − 退款 NT$
          {bal.cashOutRefunds.toLocaleString()} ＝ 淨現金 NT$
          {bal.netCash.toLocaleString()}
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          報價尚未「客戶已接受」，無法開立折讓／退款。
        </p>
      )}

      {canManage && gate.ok ? (
        <>
          <form className="stack" onSubmit={(e) => void onCredit(e)}>
            <strong>開立折讓</strong>
            <div className="grid-2">
              <div className="field">
                <label>金額</label>
                <input
                  type="number"
                  min="0"
                  value={creditAmt}
                  onChange={(e) => setCreditAmt(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>原因</label>
                <input
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              開立折讓
            </button>
          </form>

          <form className="stack" onSubmit={(e) => void onRefund(e)}>
            <strong>登錄退款（對應原收款）</strong>
            {confirmedPays.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無已確認收款可退
              </p>
            ) : (
              <>
                <div className="field">
                  <label>原收款</label>
                  <select
                    value={selectedPay}
                    onChange={(e) => setRefundPayId(e.target.value)}
                  >
                    {confirmedPays.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.paymentNumber} · NT${p.amount.toLocaleString()} ·{' '}
                        {PAYMENT_METHOD_LABELS[p.method]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>退款金額</label>
                    <input
                      type="number"
                      min="0"
                      value={refundAmt}
                      onChange={(e) => setRefundAmt(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>方式</label>
                    <select
                      value={refundMethod}
                      onChange={(e) =>
                        setRefundMethod(e.target.value as PaymentMethod)
                      }
                    >
                      <option value="transfer">轉帳</option>
                      <option value="cash">現金</option>
                      <option value="check">支票</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>原因</label>
                  <input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                  />
                </div>
                <button className="btn btn-steel" type="submit" disabled={saving}>
                  確認退款
                </button>
              </>
            )}
          </form>
        </>
      ) : gate.ok && !canManage ? (
        <p className="muted">折讓／退款需老闆／管理員權限</p>
      ) : null}

      <div className="stack">
        <strong>折讓紀錄</strong>
        {creditNotes.length === 0 ? (
          <div className="empty">尚無折讓</div>
        ) : (
          creditNotes.map((n) => (
            <div key={n.id} className="row between">
              <span>
                {n.creditNumber} · NT${n.amount.toLocaleString()} · {n.reason}
              </span>
              <span className="muted">
                {formatTaipei(n.issuedAt, 'MM/dd HH:mm')}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="stack">
        <strong>退款紀錄</strong>
        {refunds.length === 0 ? (
          <div className="empty">尚無退款</div>
        ) : (
          refunds.map((r) => (
            <div key={r.id} className="row between">
              <span>
                {r.refundNumber} · NT${r.amount.toLocaleString()} · {r.reason}
              </span>
              <span className="muted">
                {formatTaipei(r.refundedAt, 'MM/dd HH:mm')}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
