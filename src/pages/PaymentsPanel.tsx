import { useMemo, useState, type FormEvent } from 'react'
import {
  PAYMENT_METHOD_LABELS,
  billingDocumentOpenAmount,
  canManagePayments,
  canRecordPaymentForQuote,
  cashAndSettlementSummary,
} from '@/domain/payments'
import type {
  AdvanceApplication,
  BillingDocument,
  CustomerAdvance,
  CustomerPayment,
  PaymentAllocation,
  PaymentMethod,
  Quotation,
} from '@/domain/types'
import { formatTaipei } from '@/lib/time'

type Props = {
  quote: Quotation
  billingDocuments: BillingDocument[]
  payments: CustomerPayment[]
  allocations: PaymentAllocation[]
  advances: CustomerAdvance[]
  advanceApplications: AdvanceApplication[]
  userRole: string
  saving: boolean
  createCustomerPayment: (input: {
    amount: number
    method: PaymentMethod
    notes?: string
  }) => Promise<CustomerPayment>
  allocatePayment: (input: {
    paymentId: string
    billingDocumentId: string
    amount: number
  }) => Promise<PaymentAllocation>
  createCustomerAdvance: (input: {
    amount: number
    notes?: string
  }) => Promise<CustomerAdvance>
  applyCustomerAdvance: (input: {
    advanceId: string
    billingDocumentId: string
    amount: number
  }) => Promise<AdvanceApplication>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function PaymentsPanel({
  quote,
  billingDocuments,
  payments,
  allocations,
  advances,
  advanceApplications,
  userRole,
  saving,
  createCustomerPayment,
  allocatePayment,
  createCustomerAdvance,
  applyCustomerAdvance,
  onError,
  onSuccess,
}: Props) {
  const canManage = canManagePayments(userRole)
  const gate = canRecordPaymentForQuote(quote)
  const summary = useMemo(
    () =>
      cashAndSettlementSummary({
        billingDocuments,
        payments,
        allocations,
        advances,
        advanceApplications,
      }),
    [billingDocuments, payments, allocations, advances, advanceApplications],
  )

  const issuedDocs = billingDocuments.filter((d) => d.status === 'issued')
  const confirmedPays = payments.filter((p) => p.status === 'confirmed')
  const openAdvances = advances.filter((a) => a.status === 'open')

  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('transfer')
  const [allocPaymentId, setAllocPaymentId] = useState('')
  const [allocDocId, setAllocDocId] = useState('')
  const [allocAmount, setAllocAmount] = useState('')
  const [advAmount, setAdvAmount] = useState('')
  const [applyAdvId, setApplyAdvId] = useState('')
  const [applyDocId, setApplyDocId] = useState('')
  const [applyAmount, setApplyAmount] = useState('')

  const selectedPaymentId =
    allocPaymentId && confirmedPays.some((p) => p.id === allocPaymentId)
      ? allocPaymentId
      : (confirmedPays[0]?.id ?? '')
  const selectedAllocDoc =
    allocDocId && issuedDocs.some((d) => d.id === allocDocId)
      ? allocDocId
      : (issuedDocs[0]?.id ?? '')
  const selectedAdvId =
    applyAdvId && openAdvances.some((a) => a.id === applyAdvId)
      ? applyAdvId
      : (openAdvances[0]?.id ?? '')
  const selectedApplyDoc =
    applyDocId && issuedDocs.some((d) => d.id === applyDocId)
      ? applyDocId
      : (issuedDocs[0]?.id ?? '')

  async function onPay(e: FormEvent) {
    e.preventDefault()
    try {
      await createCustomerPayment({
        amount: Number(payAmount) || 0,
        method: payMethod,
      })
      setPayAmount('')
      onSuccess('已登錄收款（現金流；尚未等於請款清償）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '收款失敗')
    }
  }

  async function onAlloc(e: FormEvent) {
    e.preventDefault()
    try {
      await allocatePayment({
        paymentId: selectedPaymentId,
        billingDocumentId: selectedAllocDoc,
        amount: Number(allocAmount) || 0,
      })
      setAllocAmount('')
      onSuccess('已分配收款至請款單')
    } catch (err) {
      onError(err instanceof Error ? err.message : '分配失敗')
    }
  }

  async function onAdvance(e: FormEvent) {
    e.preventDefault()
    try {
      await createCustomerAdvance({ amount: Number(advAmount) || 0 })
      setAdvAmount('')
      onSuccess('已登錄預收款（獨立帳；≠ 請款）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '預收失敗')
    }
  }

  async function onApply(e: FormEvent) {
    e.preventDefault()
    try {
      await applyCustomerAdvance({
        advanceId: selectedAdvId,
        billingDocumentId: selectedApplyDoc,
        amount: Number(applyAmount) || 0,
      })
      setApplyAmount('')
      onSuccess('已預收抵充（不新增現金流入）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '抵充失敗')
    }
  }

  return (
    <section className="panel stack">
      <strong>收款／預收抵充（FIN-004）</strong>
      <p className="muted" style={{ margin: 0 }}>
        收款＝實際現金；分配清償請款；預收抵充不重複記現金。皆≠會計收入。
      </p>
      {quote.workflowStatus === 'accepted' ? (
        <p style={{ margin: 0 }}>
          已開立請款 NT${summary.billed.toLocaleString()}
          <br />
          已收現金 NT${summary.cashReceived.toLocaleString()}
          <br />
          已清償請款 NT${summary.settledOnBilling.toLocaleString()}
          <br />
          未分配現金 NT${summary.unallocatedCash.toLocaleString()}
          <br />
          預收剩餘 NT${summary.openAdvances.toLocaleString()}
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          報價尚未「客戶已接受」，無法登錄收款／預收。
        </p>
      )}

      {canManage && gate.ok ? (
        <>
          <form className="stack" onSubmit={(e) => void onPay(e)}>
            <strong>登錄收款</strong>
            <div className="grid-2">
              <div className="field">
                <label>金額</label>
                <input
                  type="number"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>方式</label>
                <select
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(e.target.value as PaymentMethod)
                  }
                >
                  <option value="transfer">轉帳</option>
                  <option value="cash">現金</option>
                  <option value="check">支票</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>
            <button className="btn btn-steel" type="submit" disabled={saving}>
              確認收款
            </button>
          </form>

          <form className="stack" onSubmit={(e) => void onAlloc(e)}>
            <strong>分配收款 → 請款單</strong>
            {confirmedPays.length === 0 || issuedDocs.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                需有已確認收款與已開立請款單
              </p>
            ) : (
              <>
                <div className="grid-2">
                  <div className="field">
                    <label>收款</label>
                    <select
                      value={selectedPaymentId}
                      onChange={(e) => setAllocPaymentId(e.target.value)}
                    >
                      {confirmedPays.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.paymentNumber} · NT${p.amount.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>請款單</label>
                    <select
                      value={selectedAllocDoc}
                      onChange={(e) => setAllocDocId(e.target.value)}
                    >
                      {issuedDocs.map((d) => {
                        const open = billingDocumentOpenAmount({
                          document: d,
                          allocations: allocations.filter(
                            (a) => a.billingDocumentId === d.id,
                          ),
                          advanceApplications: advanceApplications.filter(
                            (a) => a.billingDocumentId === d.id,
                          ),
                        })
                        return (
                          <option key={d.id} value={d.id}>
                            {d.documentNumber} · 未清 NT$
                            {open.toLocaleString()}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>分配金額</label>
                  <input
                    type="number"
                    min="0"
                    value={allocAmount}
                    onChange={(e) => setAllocAmount(e.target.value)}
                    required
                  />
                </div>
                <button className="btn btn-ghost" type="submit" disabled={saving}>
                  分配
                </button>
              </>
            )}
          </form>

          <form className="stack" onSubmit={(e) => void onAdvance(e)}>
            <strong>登錄預收款</strong>
            <div className="field">
              <label>金額</label>
              <input
                type="number"
                min="0"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              確認預收
            </button>
          </form>

          <form className="stack" onSubmit={(e) => void onApply(e)}>
            <strong>預收抵充請款（不新增現金）</strong>
            {openAdvances.length === 0 || issuedDocs.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                需有預收剩餘與已開立請款單
              </p>
            ) : (
              <>
                <div className="grid-2">
                  <div className="field">
                    <label>預收</label>
                    <select
                      value={selectedAdvId}
                      onChange={(e) => setApplyAdvId(e.target.value)}
                    >
                      {openAdvances.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.advanceNumber} · 剩 NT$
                          {a.remainingAmount.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>請款單</label>
                    <select
                      value={selectedApplyDoc}
                      onChange={(e) => setApplyDocId(e.target.value)}
                    >
                      {issuedDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.documentNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>抵充金額</label>
                  <input
                    type="number"
                    min="0"
                    value={applyAmount}
                    onChange={(e) => setApplyAmount(e.target.value)}
                    required
                  />
                </div>
                <button className="btn btn-steel" type="submit" disabled={saving}>
                  抵充
                </button>
              </>
            )}
          </form>
        </>
      ) : gate.ok && !canManage ? (
        <p className="muted">收款／預收管理需老闆／管理員權限</p>
      ) : null}

      <div className="stack">
        <strong>收款紀錄</strong>
        {payments.length === 0 ? (
          <div className="empty">尚無收款</div>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="row between">
              <span>
                {p.paymentNumber} · {PAYMENT_METHOD_LABELS[p.method]} · NT$
                {p.amount.toLocaleString()}
              </span>
              <span className="muted">
                {formatTaipei(p.receivedAt, 'MM/dd HH:mm')}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="stack">
        <strong>預收款</strong>
        {advances.length === 0 ? (
          <div className="empty">尚無預收</div>
        ) : (
          advances.map((a) => (
            <div key={a.id} className="row between">
              <span>
                {a.advanceNumber} · NT${a.amount.toLocaleString()}（剩{' '}
                {a.remainingAmount.toLocaleString()}）
              </span>
              <span className="badge steel">{a.status}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
