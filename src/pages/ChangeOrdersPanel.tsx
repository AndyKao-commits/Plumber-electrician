import { useEffect, useState, type FormEvent } from 'react'
import {
  CHANGE_ORDER_KIND_LABELS,
  CHANGE_ORDER_STATUS_LABELS,
  canCreateChangeOrder,
  canMarkChangeOrderAccept,
  isChangeOrderEditable,
  signedChangeOrderAmount,
} from '@/domain/changeOrders'
import { QUOTE_ITEM_KIND_LABELS } from '@/domain/rules'
import type {
  ChangeOrder,
  ChangeOrderItem,
  ChangeOrderKind,
  ChangeOrderStatus,
  Quotation,
  QuotationItemKind,
} from '@/domain/types'
import { formatTaipei } from '@/lib/time'

type Props = {
  quote: Quotation
  changeOrders: ChangeOrder[]
  userRole: string
  saving: boolean
  createChangeOrder: (input: {
    kind: ChangeOrderKind
    title: string
    notes?: string
  }) => Promise<ChangeOrder>
  addChangeOrderItem: (input: {
    changeOrderId: string
    kind: QuotationItemKind
    description: string
    qty: number
    unit?: string
    unitPrice: number
  }) => Promise<ChangeOrderItem>
  removeChangeOrderItem: (itemId: string) => Promise<void>
  setChangeOrderStatus: (input: {
    changeOrderId: string
    status: ChangeOrderStatus
  }) => Promise<ChangeOrder>
  listChangeOrderItems: (changeOrderId: string) => Promise<ChangeOrderItem[]>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function ChangeOrdersPanel({
  quote,
  changeOrders,
  userRole,
  saving,
  createChangeOrder,
  addChangeOrderItem,
  removeChangeOrderItem,
  setChangeOrderStatus,
  listChangeOrderItems,
  onError,
  onSuccess,
}: Props) {
  const createGate = canCreateChangeOrder(userRole, quote)
  const canMark = canMarkChangeOrderAccept(userRole)

  const [kind, setKind] = useState<ChangeOrderKind>('addition')
  const [title, setTitle] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [itemsById, setItemsById] = useState<Record<string, ChangeOrderItem[]>>(
    {},
  )
  const [itemKind, setItemKind] = useState<QuotationItemKind>('labor')
  const [itemDesc, setItemDesc] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemUnit, setItemUnit] = useState('式')
  const [itemPrice, setItemPrice] = useState('')

  useEffect(() => {
    if (!expandedId) return
    let cancelled = false
    void listChangeOrderItems(expandedId)
      .then((rows) => {
        if (!cancelled) {
          setItemsById((prev) => ({ ...prev, [expandedId]: rows }))
        }
      })
      .catch((e: unknown) =>
        onError(e instanceof Error ? e.message : '載入細項失敗'),
      )
    return () => {
      cancelled = true
    }
  }, [expandedId, listChangeOrderItems, onError, changeOrders])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      const created = await createChangeOrder({
        kind,
        title: title.trim() || CHANGE_ORDER_KIND_LABELS[kind],
      })
      setTitle('')
      setExpandedId(created.id)
      onSuccess('已建立追加減草稿（未計入合約）')
    } catch (err) {
      onError(err instanceof Error ? err.message : '建立失敗')
    }
  }

  async function onAddItem(e: FormEvent, changeOrderId: string) {
    e.preventDefault()
    try {
      await addChangeOrderItem({
        changeOrderId,
        kind: itemKind,
        description: itemDesc,
        qty: Number(itemQty) || 0,
        unit: itemUnit,
        unitPrice: Number(itemPrice) || 0,
      })
      setItemDesc('')
      setItemPrice('')
      setItemQty('1')
      const rows = await listChangeOrderItems(changeOrderId)
      setItemsById((prev) => ({ ...prev, [changeOrderId]: rows }))
      onSuccess('已加入細項')
    } catch (err) {
      onError(err instanceof Error ? err.message : '細項失敗')
    }
  }

  const acceptedDelta = changeOrders.reduce(
    (sum, co) => sum + signedChangeOrderAmount(co),
    0,
  )

  return (
    <section className="panel stack">
      <strong>追加減（FIN-002）</strong>
      <p className="muted" style={{ margin: 0 }}>
        僅「客戶已接受」的追加／追減會調整有效合約。草稿與未接受不計入。
      </p>
      {quote.workflowStatus === 'accepted' ? (
        <p style={{ margin: 0 }}>
          本案件合約影響（已接受追加減）：
          <strong>
            {acceptedDelta >= 0 ? '+' : ''}
            NT${acceptedDelta.toLocaleString()}
          </strong>
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          報價尚未標記「客戶已接受」，無法建立追加減。
        </p>
      )}

      {createGate.ok ? (
        <form className="stack" onSubmit={(e) => void onCreate(e)}>
          <div className="grid-2">
            <div className="field">
              <label>類型</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ChangeOrderKind)}
              >
                <option value="addition">追加</option>
                <option value="reduction">追減</option>
              </select>
            </div>
            <div className="field">
              <label>標題</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：增設插座"
              />
            </div>
          </div>
          <button className="btn btn-steel" type="submit" disabled={saving}>
            建立追加減草稿
          </button>
        </form>
      ) : quote.workflowStatus === 'accepted' ? (
        <p className="muted">{createGate.reason}</p>
      ) : null}

      {changeOrders.length === 0 ? (
        <div className="empty">尚無追加減</div>
      ) : (
        <div className="stack">
          {changeOrders.map((co) => {
            const editable = isChangeOrderEditable(co.status)
            const items = itemsById[co.id] ?? []
            const open = expandedId === co.id
            return (
              <div key={co.id} className="site-link stack">
                <div className="row between" style={{ gap: 8 }}>
                  <div>
                    <strong>
                      {CHANGE_ORDER_KIND_LABELS[co.kind]} · {co.title}
                    </strong>
                    <p className="muted" style={{ margin: 0 }}>
                      {co.changeNumber} ·{' '}
                      {CHANGE_ORDER_STATUS_LABELS[co.status]} · NT${' '}
                      {co.amountAfterTax.toLocaleString()}
                      {co.acceptedAt
                        ? ` · 接受 ${formatTaipei(co.acceptedAt, 'MM/dd HH:mm')}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setExpandedId((id) => (id === co.id ? null : co.id))
                    }
                  >
                    {open ? '收合' : '展開'}
                  </button>
                </div>

                {open ? (
                  <div className="stack">
                    {items.length === 0 ? (
                      <div className="empty">尚未建立細項</div>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="row between">
                          <span>
                            #{item.lineNo} {QUOTE_ITEM_KIND_LABELS[item.kind]}{' '}
                            · {item.description} · {item.qty}
                            {item.unit} × NT$
                            {item.unitPrice.toLocaleString()}
                          </span>
                          {editable ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={saving}
                              onClick={() =>
                                void removeChangeOrderItem(item.id)
                                  .then(async () => {
                                    const rows = await listChangeOrderItems(
                                      co.id,
                                    )
                                    setItemsById((prev) => ({
                                      ...prev,
                                      [co.id]: rows,
                                    }))
                                  })
                                  .catch((err: unknown) =>
                                    onError(
                                      err instanceof Error
                                        ? err.message
                                        : '刪除失敗',
                                    ),
                                  )
                              }
                            >
                              刪除
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}

                    {editable ? (
                      <form
                        className="stack"
                        onSubmit={(e) => void onAddItem(e, co.id)}
                      >
                        <strong>新增細項</strong>
                        <div className="grid-2">
                          <div className="field">
                            <label>類型</label>
                            <select
                              value={itemKind}
                              onChange={(e) =>
                                setItemKind(
                                  e.target.value as QuotationItemKind,
                                )
                              }
                            >
                              <option value="material">材料</option>
                              <option value="labor">工資</option>
                              <option value="other">其他</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>單位</label>
                            <input
                              value={itemUnit}
                              onChange={(e) => setItemUnit(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label>說明</label>
                          <input
                            value={itemDesc}
                            onChange={(e) => setItemDesc(e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid-2">
                          <div className="field">
                            <label>數量</label>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={itemQty}
                              onChange={(e) => setItemQty(e.target.value)}
                              required
                            />
                          </div>
                          <div className="field">
                            <label>單價</label>
                            <input
                              type="number"
                              min="0"
                              value={itemPrice}
                              onChange={(e) => setItemPrice(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <button
                          className="btn btn-ghost"
                          type="submit"
                          disabled={saving}
                        >
                          加入細項
                        </button>
                      </form>
                    ) : null}

                    {canMark && editable ? (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={saving}
                          onClick={() =>
                            void setChangeOrderStatus({
                              changeOrderId: co.id,
                              status: 'sent_to_customer',
                            })
                              .then(() => onSuccess('已標記提供客戶'))
                              .catch((err: unknown) =>
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : '更新失敗',
                                ),
                              )
                          }
                        >
                          標記已提供客戶
                        </button>
                        <button
                          type="button"
                          className="btn btn-steel"
                          disabled={saving}
                          onClick={() =>
                            void setChangeOrderStatus({
                              changeOrderId: co.id,
                              status: 'accepted',
                            })
                              .then(() =>
                                onSuccess('客戶已接受，已計入有效合約'),
                              )
                              .catch((err: unknown) =>
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : '更新失敗',
                                ),
                              )
                          }
                        >
                          客戶已接受
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={saving}
                          onClick={() =>
                            void setChangeOrderStatus({
                              changeOrderId: co.id,
                              status: 'rejected',
                            })
                              .then(() => onSuccess('已標記未接受'))
                              .catch((err: unknown) =>
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : '更新失敗',
                                ),
                              )
                          }
                        >
                          客戶未接受
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={saving}
                          onClick={() =>
                            void setChangeOrderStatus({
                              changeOrderId: co.id,
                              status: 'cancelled',
                            })
                              .then(() => onSuccess('已取消追加減'))
                              .catch((err: unknown) =>
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : '更新失敗',
                                ),
                              )
                          }
                        >
                          取消
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
