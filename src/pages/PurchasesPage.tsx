import { useState, type FormEvent } from 'react'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  DEFAULT_PURCHASE_RULES,
  calcFinalPayable,
  requiresPreApproval,
} from '@/domain/rules'
import { usePurchases } from '@/hooks/usePurchases'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function PurchasesPage() {
  const { user } = useUser()
  const { sites } = useSites()
  const {
    purchases,
    pendingApprovals,
    emergencyUsedToday,
    createPurchase,
    isCreating,
    createError,
    approvePurchase,
    isApproving,
    approveError,
    rejectPurchase,
    isRejecting,
    rejectError,
    cancelEmergency,
  } = usePurchases(user?.id)

  const canApprove =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.PURCHASE_APPROVE)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'normal' | 'emergency'>('normal')
  const [siteId, setSiteId] = useState('')
  const [goodsAmount, setGoodsAmount] = useState('2800')
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const [shipping, setShipping] = useState('150')
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})

  const preview = calcFinalPayable({
    goodsAmount: Number(goodsAmount) || 0,
    discount: Number(discount) || 0,
    tax: Number(tax) || 0,
    shipping: Number(shipping) || 0,
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await createPurchase({
      title,
      mode,
      siteId: siteId || undefined,
      goodsAmount: Number(goodsAmount) || 0,
      discount: Number(discount) || 0,
      tax: Number(tax) || 0,
      shipping: Number(shipping) || 0,
    })
    setTitle('')
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>材料採購</strong>
        <p className="muted" style={{ margin: 0 }}>
          核准基準＝最終應付金額。一般 ≥ NT$
          {DEFAULT_PURCHASE_RULES.preApprovalThresholdNtd.toLocaleString()}；緊急單次 ≤{' '}
          {DEFAULT_PURCHASE_RULES.emergencySingleLimitNtd.toLocaleString()}、每日 ≤{' '}
          {DEFAULT_PURCHASE_RULES.emergencyDailyLimitNtd?.toLocaleString()}。
          緊急占額以不可變事件記在原業務日（REV-04）；禁止自我核准（REV-07）。
        </p>
        <div className="site-link">
          <p>今日已用緊急額度</p>
          <h3>
            NT${emergencyUsedToday.toLocaleString()} /{' '}
            {DEFAULT_PURCHASE_RULES.emergencyDailyLimitNtd?.toLocaleString()}
          </h3>
        </div>
      </section>

      {canApprove && pendingApprovals.length > 0 ? (
        <section className="panel stack">
          <strong>待核准</strong>
          {pendingApprovals.map((p) => (
            <div key={p.id} className="site-link stack">
              <div className="row between">
                <h3 style={{ margin: 0 }}>{p.title}</h3>
                <span className="badge">pending</span>
              </div>
              <p style={{ margin: 0 }}>
                NT${p.finalPayable.toLocaleString()} · 申請人 {p.userId}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-steel"
                  disabled={isApproving || isRejecting || user?.id === p.userId}
                  onClick={() => void approvePurchase(p.id)}
                >
                  核准
                </button>
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor={`reject-${p.id}`}>駁回原因</label>
                <input
                  id={`reject-${p.id}`}
                  value={rejectReasons[p.id] ?? ''}
                  onChange={(e) =>
                    setRejectReasons((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  placeholder="必填"
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={
                  isApproving ||
                  isRejecting ||
                  user?.id === p.userId ||
                  !(rejectReasons[p.id] ?? '').trim()
                }
                onClick={() =>
                  void rejectPurchase({
                    purchaseId: p.id,
                    reason: rejectReasons[p.id] ?? '',
                  })
                }
              >
                駁回
              </button>
            </div>
          ))}
          {approveError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(approveError as Error).message}
            </p>
          ) : null}
          {rejectError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(rejectError as Error).message}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="panel stack">
        <strong>新增採購</strong>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label htmlFor="pur-title">品項</label>
            <input
              id="pur-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：止水材料"
              required
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pur-mode">模式</label>
              <select
                id="pur-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'normal' | 'emergency')}
              >
                <option value="normal">一般採購</option>
                <option value="emergency">緊急採購</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pur-site">工地（選填）</label>
              <select
                id="pur-site"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="">未指定</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pur-goods">商品金額</label>
              <input
                id="pur-goods"
                type="number"
                min="0"
                step="1"
                value={goodsAmount}
                onChange={(e) => setGoodsAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pur-discount">折扣</label>
              <input
                id="pur-discount"
                type="number"
                min="0"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pur-tax">稅額</label>
              <input
                id="pur-tax"
                type="number"
                min="0"
                step="1"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pur-ship">運費</label>
              <input
                id="pur-ship"
                type="number"
                min="0"
                step="1"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
              />
            </div>
          </div>
          <div className="site-link">
            <p>最終應付金額</p>
            <h3>NT${preview.toLocaleString()}</h3>
            <p>
              {mode === 'normal'
                ? requiresPreApproval(preview)
                  ? '需老闆事前核准'
                  : '免事前核准'
                : '緊急通道（寫入 RESERVE 事件）'}
            </p>
          </div>
          {createError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createError as Error).message}
            </p>
          ) : null}
          <button className="btn btn-steel btn-block" type="submit" disabled={isCreating}>
            {isCreating ? '送出中…' : '登記採購'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>最近採購</strong>
        {purchases.length === 0 ? (
          <div className="empty">尚無採購紀錄</div>
        ) : (
          purchases.map((p) => (
            <div key={p.id} className="site-link stack">
              <div className="row between">
                <span className="badge steel">
                  {p.mode === 'emergency' ? '緊急' : '一般'}
                </span>
                <span className="badge">{p.status}</span>
              </div>
              <h3 style={{ margin: 0 }}>{p.title}</h3>
              <p style={{ margin: 0 }}>
                NT${p.finalPayable.toLocaleString()} ·{' '}
                {formatTaipei(p.createdAt, 'MM/dd HH:mm')} · 業務日 {p.businessDate}
              </p>
              {p.mode === 'emergency' && p.status !== 'cancelled' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    void cancelEmergency({
                      purchaseId: p.id,
                      reason: '示範取消並原日釋放額度',
                    })
                  }
                >
                  取消並釋放當日額度
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
