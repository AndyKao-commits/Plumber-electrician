import { useMemo, useState, type FormEvent } from 'react'
import {
  canRecordOperatingCost,
  canViewCostAndMargin,
  computeCaseFinanceSummary,
  OPERATING_COST_KIND_LABELS,
} from '@/domain/financeSummary'
import type {
  BillingDocument,
  CaseOperatingCost,
  ChangeOrder,
  CustomerCreditNote,
  CustomerPayment,
  CustomerRefund,
  OperatingCostKind,
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
  operatingCosts: CaseOperatingCost[]
  userRole: string
  financeAuthorized?: boolean
  saving: boolean
  createCaseOperatingCost: (input: {
    kind: OperatingCostKind
    description: string
    amount: number
    warrantyFree?: boolean
  }) => Promise<CaseOperatingCost>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function FinanceSummaryPanel({
  quote,
  changeOrders,
  billingDocuments,
  payments,
  creditNotes,
  refunds,
  operatingCosts,
  userRole,
  financeAuthorized = false,
  saving,
  createCaseOperatingCost,
  onError,
  onSuccess,
}: Props) {
  const canRecord = canRecordOperatingCost(userRole, financeAuthorized)
  const canSeeCost = canViewCostAndMargin(userRole, financeAuthorized)
  const summary = useMemo(
    () =>
      computeCaseFinanceSummary({
        quotes: [quote],
        changeOrders,
        billingDocuments,
        payments,
        creditNotes,
        refunds,
        operatingCosts,
        viewer: { role: userRole, financeAuthorized },
      }),
    [
      quote,
      changeOrders,
      billingDocuments,
      payments,
      creditNotes,
      refunds,
      operatingCosts,
      userRole,
      financeAuthorized,
    ],
  )

  const [kind, setKind] = useState<OperatingCostKind>('material')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [warrantyFree, setWarrantyFree] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createCaseOperatingCost({
        kind,
        description,
        amount: Number(amount) || 0,
        warrantyFree,
      })
      setDescription('')
      setAmount('')
      setWarrantyFree(false)
      onSuccess('已登錄營運成本')
    } catch (err) {
      onError(err instanceof Error ? err.message : '登錄成本失敗')
    }
  }

  return (
    <section className="panel stack">
      <strong>工程／維修財務摘要</strong>

      <p style={{ margin: 0 }}>
        有效合約 NT${summary.contract.toLocaleString()}
        <br />
        淨應收（請款−折讓）NT${summary.netReceivable.toLocaleString()}
        <br />
        淨現金（收款−退款）NT${summary.netCash.toLocaleString()}
      </p>

      {canSeeCost ? (
        <p style={{ margin: 0 }}>
          已確認營運成本 NT$
          {(summary.confirmedCost ?? 0).toLocaleString()}
          <br />
          差額（合約−成本）NT$
          {(summary.indicativeMarginVsContract ?? 0).toLocaleString()}
          {summary.warrantyFreeCase ? (
            <>
              <br />
              <span className="muted">免費／保固案件：客戶收費可為 0，成本仍保留</span>
            </>
          ) : null}
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          無權限查看成本
        </p>
      )}

      {canRecord ? (
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <strong>登錄已確認營運成本</strong>
          <div className="grid-2">
            <div className="field">
              <label>類型</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as OperatingCostKind)}
              >
                <option value="material">材料成本</option>
                <option value="labor_ops">施工營運成本</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="field">
              <label>金額</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>說明</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={warrantyFree}
              onChange={(e) => setWarrantyFree(e.target.checked)}
            />
            免費／保固（客戶可不收費，仍記成本）
          </label>
          <button className="btn btn-ghost" type="submit" disabled={saving}>
            登錄成本
          </button>
        </form>
      ) : null}

      {canSeeCost ? (
        <div className="stack">
          <strong>成本明細</strong>
          {operatingCosts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              尚無已確認營運成本
            </p>
          ) : (
            operatingCosts.map((c) => (
              <p key={c.id} style={{ margin: 0 }}>
                {OPERATING_COST_KIND_LABELS[c.kind]} · NT$
                {c.amount.toLocaleString()}
                {c.warrantyFree ? ' · 保固／免費' : ''} · {c.description}
                <br />
                <span className="muted">
                  {formatTaipei(c.confirmedAt, 'MM/dd HH:mm')} · {c.status}
                </span>
              </p>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}
