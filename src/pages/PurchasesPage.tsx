import { useState, type FormEvent } from 'react'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  DEFAULT_PURCHASE_RULES,
  calcFinalPayable,
  requiresPreApproval,
} from '@/domain/rules'
import { useInventory } from '@/hooks/useInventory'
import { usePurchases } from '@/hooks/usePurchases'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
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
    purchaseInbound,
    isInbound,
    inboundError,
  } = usePurchases(user?.id)
  const { materials, createMaterial, isCreatingMaterial } = useInventory(user?.id)
  const formal = isFormalMode()

  const canApprove =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.PURCHASE_APPROVE)
  const canInbound =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.INVENTORY_INBOUND)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'normal' | 'emergency'>('normal')
  const [siteId, setSiteId] = useState('')
  const [goodsAmount, setGoodsAmount] = useState('2800')
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const [shipping, setShipping] = useState('150')
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [inboundDraft, setInboundDraft] = useState<
    Record<string, { materialId: string; qty: string; unitCost: string }>
  >({})

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
              {formal &&
              canInbound &&
              (p.status === 'approved' || p.status === 'purchased') &&
              !p.inboundAt ? (
                <div className="stack">
                  <strong style={{ margin: 0 }}>採購入庫</strong>
                  <div className="field">
                    <label htmlFor={`in-mat-${p.id}`}>材料</label>
                    <select
                      id={`in-mat-${p.id}`}
                      value={inboundDraft[p.id]?.materialId ?? materials[0]?.id ?? ''}
                      onChange={(e) =>
                        setInboundDraft((prev) => ({
                          ...prev,
                          [p.id]: {
                            materialId: e.target.value,
                            qty: prev[p.id]?.qty ?? '1',
                            unitCost:
                              prev[p.id]?.unitCost ??
                              String(Math.round(p.goodsAmount) || 0),
                          },
                        }))
                      }
                    >
                      {materials.length === 0 ? (
                        <option value="">尚無材料</option>
                      ) : null}
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}（庫存 {m.qty}）
                        </option>
                      ))}
                    </select>
                  </div>
                  {materials.length === 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={isCreatingMaterial}
                      onClick={() =>
                        void createMaterial({ name: p.title || '採購材料', unit: '式' })
                      }
                    >
                      {isCreatingMaterial ? '建立中…' : `用「${p.title}」建立材料`}
                    </button>
                  ) : null}
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor={`in-qty-${p.id}`}>數量</label>
                      <input
                        id={`in-qty-${p.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={inboundDraft[p.id]?.qty ?? '1'}
                        onChange={(e) =>
                          setInboundDraft((prev) => ({
                            ...prev,
                            [p.id]: {
                              materialId:
                                prev[p.id]?.materialId ?? materials[0]?.id ?? '',
                              qty: e.target.value,
                              unitCost:
                                prev[p.id]?.unitCost ??
                                String(Math.round(p.goodsAmount) || 0),
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`in-cost-${p.id}`}>入庫單價</label>
                      <input
                        id={`in-cost-${p.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          inboundDraft[p.id]?.unitCost ??
                          String(Math.round(p.goodsAmount) || 0)
                        }
                        onChange={(e) =>
                          setInboundDraft((prev) => ({
                            ...prev,
                            [p.id]: {
                              materialId:
                                prev[p.id]?.materialId ?? materials[0]?.id ?? '',
                              qty: prev[p.id]?.qty ?? '1',
                              unitCost: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                  {inboundError ? (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>
                      {inboundError.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-steel"
                    disabled={
                      isInbound ||
                      !(inboundDraft[p.id]?.materialId ?? materials[0]?.id)
                    }
                    onClick={() => {
                      const draft = inboundDraft[p.id]
                      const materialId = draft?.materialId ?? materials[0]?.id
                      if (!materialId) return
                      void purchaseInbound({
                        purchaseId: p.id,
                        materialId,
                        qty: Number(draft?.qty ?? 1) || 1,
                        unitCost: Number(
                          draft?.unitCost ?? p.goodsAmount,
                        ),
                      })
                    }}
                  >
                    {isInbound ? '入庫中…' : '確認入庫並標記已採購'}
                  </button>
                </div>
              ) : null}
              {p.inboundAt ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  已入庫 qty {p.inboundQty} ·{' '}
                  {formatTaipei(p.inboundAt, 'MM/dd HH:mm')}
                </p>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
