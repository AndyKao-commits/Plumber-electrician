import { useMemo, useState } from 'react'
import { usePurchases } from '@/hooks/usePurchases'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useUser } from '@/hooks/useUser'
import { sumSupplierExposure, availableCredit } from '@/domain/suppliers'
import { formatTaipei } from '@/lib/time'

export function SuppliersPage() {
  const { user } = useUser()
  const {
    suppliers,
    createSupplier,
    isCreating,
    createError,
    linkPurchase,
    markPaid,
    isMarkingPaid,
  } = useSuppliers(user?.id)
  const { purchases } = usePurchases(user?.id)
  const [name, setName] = useState('')
  const [credit, setCredit] = useState('50000')
  const [terms, setTerms] = useState('30')
  const [linkPurchaseId, setLinkPurchaseId] = useState('')
  const [linkSupplierId, setLinkSupplierId] = useState('')

  const exposures = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof sumSupplierExposure> & { availableCredit: number | null }
    >()
    for (const s of suppliers) {
      const related = purchases.filter((p) => p.supplierId === s.id)
      const sums = sumSupplierExposure(related)
      map.set(s.id, {
        ...sums,
        availableCredit: availableCredit({
          creditLimit: s.creditLimit,
          exposure: sums.exposure,
        }),
      })
    }
    return map
  }, [suppliers, purchases])

  const unlinked = purchases.filter((p) => !p.supplierId)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>供應商應付與信用額度</strong>
        <p className="muted" style={{ margin: 0 }}>
          未付款應付與未收貨承諾分開加總、不重複計算；未設定額度時不自行推測。
        </p>
      </section>

      <section className="panel stack">
        <strong>供應商</strong>
        {suppliers.length === 0 ? <div className="empty">尚無供應商</div> : null}
        {suppliers.map((s) => {
          const exp = exposures.get(s.id)
          return (
            <div key={s.id} className="site-link stack">
              <div className="row between">
                <h3 style={{ margin: 0 }}>{s.name}</h3>
                <span className="badge">月結 {s.paymentTermsDays} 日</span>
              </div>
              <p style={{ margin: 0 }}>
                信用額度{' '}
                {s.creditLimit == null
                  ? '未設定'
                  : `NT$${s.creditLimit.toLocaleString()}`}
              </p>
              <p style={{ margin: 0 }}>
                未付款 NT${(exp?.unpaidPayable ?? 0).toLocaleString()} · 未收貨承諾
                NT${(exp?.openCommitment ?? 0).toLocaleString()} · 曝險 NT$
                {(exp?.exposure ?? 0).toLocaleString()}
                {exp?.availableCredit != null
                  ? ` · 剩餘額度 NT$${exp.availableCredit.toLocaleString()}`
                  : ''}
              </p>
              {purchases
                .filter((p) => p.supplierId === s.id && p.inboundAt && !p.paidAt)
                .map((p) => (
                  <div key={p.id} className="row between">
                    <span>
                      應付 {p.title} · NT${p.finalPayable.toLocaleString()}
                    </span>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={isMarkingPaid}
                      onClick={() => void markPaid(p.id)}
                    >
                      標記已付款
                    </button>
                  </div>
                ))}
            </div>
          )
        })}
      </section>

      <section className="panel stack">
        <strong>新增供應商</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void createSupplier({
              name,
              creditLimit: Number(credit) || null,
              paymentTermsDays: Number(terms) || 30,
            }).then(() => {
              setName('')
            })
          }}
        >
          <div className="field">
            <label htmlFor="sup-name">名稱</label>
            <input
              id="sup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="sup-credit">信用額度</label>
              <input
                id="sup-credit"
                type="number"
                min="0"
                step="1"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sup-terms">月結天數</label>
              <input
                id="sup-terms"
                type="number"
                min="0"
                step="1"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </div>
          </div>
          {createError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel"
            type="submit"
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? '建立中…' : '建立供應商'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>採購關聯供應商</strong>
        {unlinked.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            所有採購皆已關聯（或尚無採購）
          </p>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              if (!linkPurchaseId || !linkSupplierId) return
              void linkPurchase({
                purchaseId: linkPurchaseId,
                supplierId: linkSupplierId,
              })
            }}
          >
            <div className="field">
              <label htmlFor="link-pur">採購</label>
              <select
                id="link-pur"
                value={linkPurchaseId || unlinked[0]?.id || ''}
                onChange={(e) => setLinkPurchaseId(e.target.value)}
              >
                {unlinked.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · NT${p.finalPayable.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="link-sup">供應商</label>
              <select
                id="link-sup"
                value={linkSupplierId || suppliers[0]?.id || ''}
                onChange={(e) => setLinkSupplierId(e.target.value)}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-ghost"
              type="submit"
              disabled={suppliers.length === 0 || unlinked.length === 0}
            >
              關聯並檢查信用額度
            </button>
          </form>
        )}
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          更新示範 {formatTaipei(new Date(), 'MM/dd HH:mm')}
        </p>
      </section>
    </div>
  )
}
