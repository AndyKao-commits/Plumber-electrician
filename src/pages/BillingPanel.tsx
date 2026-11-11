import { useMemo, useState, type FormEvent } from 'react'
import {
  BILLING_DOCUMENT_STATUS_LABELS,
  BILLING_MILESTONE_STATUS_LABELS,
  billingRemainingAgainstContract,
  canCreateBillingForQuote,
  canManageBilling,
} from '@/domain/billing'
import type {
  BillingDocument,
  BillingMilestone,
  ChangeOrder,
  Quotation,
} from '@/domain/types'
import { formatTaipei } from '@/lib/time'

type Props = {
  quote: Quotation
  changeOrders: ChangeOrder[]
  milestones: BillingMilestone[]
  documents: BillingDocument[]
  userRole: string
  saving: boolean
  createBillingMilestone: (input: {
    code: string
    title: string
    plannedAmount: number
  }) => Promise<BillingMilestone>
  createBillingDocument: (input: {
    milestoneId: string
    title?: string
  }) => Promise<BillingDocument>
  issueBillingDocument: (documentId: string) => Promise<BillingDocument>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function BillingPanel({
  quote,
  changeOrders,
  milestones,
  documents,
  userRole,
  saving,
  createBillingMilestone,
  createBillingDocument,
  issueBillingDocument,
  onError,
  onSuccess,
}: Props) {
  const canManage = canManageBilling(userRole)
  const createGate = canCreateBillingForQuote(quote)
  const rem = useMemo(
    () =>
      billingRemainingAgainstContract({
        quotes: [quote],
        changeOrders,
        billingDocuments: documents,
      }),
    [quote, changeOrders, documents],
  )

  const [code, setCode] = useState('DEPOSIT')
  const [title, setTitle] = useState('訂金')
  const [planned, setPlanned] = useState('')
  const [milestoneId, setMilestoneId] = useState('')

  const selectableMilestones = milestones.filter(
    (m) =>
      m.status !== 'cancelled' &&
      !documents.some((d) => d.milestoneId === m.id && d.status === 'issued'),
  )
  const selectedMilestoneId =
    milestoneId && selectableMilestones.some((m) => m.id === milestoneId)
      ? milestoneId
      : (selectableMilestones[0]?.id ?? '')

  async function onCreateMilestone(e: FormEvent) {
    e.preventDefault()
    try {
      await createBillingMilestone({
        code,
        title,
        plannedAmount: Number(planned) || 0,
      })
      setPlanned('')
      onSuccess('已建立請款節點（尚未開立正式請款單）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '建立節點失敗')
    }
  }

  async function onCreateDoc() {
    if (!selectedMilestoneId) {
      onError('請先建立請款節點')
      return
    }
    try {
      await createBillingDocument({ milestoneId: selectedMilestoneId })
      onSuccess('已建立請款單草稿')
    } catch (err) {
      onError(err instanceof Error ? err.message : '建立請款單失敗')
    }
  }

  return (
    <section className="panel stack">
      <strong>分期請款</strong>
      {quote.workflowStatus === 'accepted' ? (
        <p style={{ margin: 0 }}>
          有效合約 NT${rem.contract.toLocaleString()}
          <br />
          已開立請款 NT${rem.billed.toLocaleString()}
          <br />
          尚未請款 NT${rem.remaining.toLocaleString()}
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          報價尚未「客戶已接受」，無法建立請款節點。
        </p>
      )}

      {canManage && createGate.ok ? (
        <>
          <form className="stack" onSubmit={(e) => void onCreateMilestone(e)}>
            <strong>新增請款節點</strong>
            <div className="grid-2">
              <div className="field">
                <label>代碼</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="DEPOSIT"
                  required
                />
              </div>
              <div className="field">
                <label>名稱</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="訂金"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>計畫金額</label>
              <input
                type="number"
                min="0"
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              建立節點
            </button>
          </form>

          <div className="stack">
            <strong>開立請款單草稿</strong>
            {selectableMilestones.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                無可開立的節點（請先新增，或節點已有正式請款）
              </p>
            ) : (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={selectedMilestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                >
                  {selectableMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.title} · NT$
                      {m.plannedAmount.toLocaleString()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-steel"
                  disabled={saving}
                  onClick={() => void onCreateDoc()}
                >
                  建立草稿
                </button>
              </div>
            )}
          </div>
        </>
      ) : createGate.ok && !canManage ? (
        <p className="muted">請款管理需老闆／管理員權限</p>
      ) : null}

      <div className="stack">
        <strong>請款節點</strong>
        {milestones.length === 0 ? (
          <div className="empty">尚無請款節點</div>
        ) : (
          milestones.map((m) => (
            <div key={m.id} className="row between">
              <span>
                {m.sequence}. {m.code} · {m.title} · NT$
                {m.plannedAmount.toLocaleString()}
              </span>
              <span className="badge steel">
                {BILLING_MILESTONE_STATUS_LABELS[m.status]}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="stack">
        <strong>請款單據</strong>
        {documents.length === 0 ? (
          <div className="empty">尚無請款單</div>
        ) : (
          documents.map((d) => {
            const ms = milestones.find((m) => m.id === d.milestoneId)
            return (
              <div key={d.id} className="site-link stack">
                <div className="row between" style={{ gap: 8 }}>
                  <div>
                    <strong>
                      {d.documentNumber} · {d.title}
                    </strong>
                    <p className="muted" style={{ margin: 0 }}>
                      節點 {ms?.code || '—'} ·{' '}
                      {BILLING_DOCUMENT_STATUS_LABELS[d.status]} · NT${' '}
                      {d.amountAfterTax.toLocaleString()}
                      {d.issuedAt
                        ? ` · 開立 ${formatTaipei(d.issuedAt, 'MM/dd HH:mm')}`
                        : ''}
                    </p>
                  </div>
                  {canManage && d.status === 'draft' ? (
                    <button
                      type="button"
                      className="btn btn-steel"
                      disabled={saving}
                      onClick={() =>
                        void issueBillingDocument(d.id)
                          .then(() =>
                            onSuccess('已開立正式請款單（內容已凍結）'),
                          )
                          .catch((err: unknown) =>
                            onError(
                              err instanceof Error ? err.message : '開立失敗',
                            ),
                          )
                      }
                    >
                      開立正式請款
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
