import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  CUSTOMER_ACCEPT_LABELS,
  QUOTE_WORKFLOW_LABELS,
  calcQuoteTotals,
  isQuoteEditable,
} from '@/domain/quoteWorkflow'
import { QUOTE_ITEM_KIND_LABELS } from '@/domain/rules'
import type { QuotationItemKind, TaxMode } from '@/domain/types'
import { useQuoteDetail } from '@/hooks/useQuotes'
import { useUser } from '@/hooks/useUser'
import {
  buildQuoteCsv,
  buildQuotePrintHtml,
  downloadTextFile,
  openPrintWindow,
} from '@/lib/quoteExport'
import { formatTaipei } from '@/lib/time'

export function QuoteDetailPage() {
  const { quoteId = '' } = useParams()
  const [search] = useSearchParams()
  const { user } = useUser()
  const {
    quote,
    items,
    versions,
    isLoading,
    error,
    updateMeta,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    exportVersion,
    setStatus,
    saving,
  } = useQuoteDetail(quoteId)

  const canEdit =
    Boolean(user) &&
    hasPermission(user!.role, PERMISSIONS.QUOTE_CREATE) &&
    isQuoteEditable(quote?.workflowStatus)
  const canExport =
    Boolean(user) &&
    (hasPermission(user!.role, PERMISSIONS.QUOTE_EXPORT) ||
      hasPermission(user!.role, PERMISSIONS.QUOTE_PUBLISH))
  const canMark =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.QUOTE_MARK_ACCEPT)

  const [actionError, setActionError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [taxMode, setTaxMode] = useState<TaxMode>('exclusive')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('依約定')
  const [validUntil, setValidUntil] = useState('')

  const [kind, setKind] = useState<QuotationItemKind>('material')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('式')
  const [unitPrice, setUnitPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!quote) return
    setTitle(quote.title)
    setCustomerName(quote.customerName)
    setSiteAddress(quote.siteAddress)
    setTaxMode(quote.taxMode)
    setDiscount(String(quote.discount ?? 0))
    setNotes(quote.notes || '')
    setPaymentTerms(quote.paymentTerms || '依約定')
    setValidUntil(quote.validUntil || '')
  }, [quote])

  const totals = useMemo(
    () =>
      calcQuoteTotals({
        items,
        discount: Number(discount) || 0,
        taxMode,
        taxRate: quote?.taxRate,
      }),
    [items, discount, taxMode, quote?.taxRate],
  )

  useEffect(() => {
    if (search.get('export') === '1' && quote && canExport) {
      // highlight export panel; no auto-run
    }
  }, [search, quote, canExport])

  async function saveMeta(e: FormEvent) {
    e.preventDefault()
    setActionError(null)
    try {
      await updateMeta({
        title,
        customerName,
        siteAddress,
        taxMode,
        discount: Number(discount) || 0,
        notes,
        paymentTerms,
        validUntil: validUntil || null,
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '儲存失敗')
    }
  }

  async function submitItem(e: FormEvent) {
    e.preventDefault()
    setActionError(null)
    try {
      if (editingId) {
        await updateItem({
          itemId: editingId,
          patch: {
            kind,
            description,
            qty: Number(qty) || 0,
            unit,
            unitPrice: Number(unitPrice) || 0,
          },
        })
        setEditingId(null)
      } else {
        await addItem({
          kind,
          description,
          qty: Number(qty) || 0,
          unit,
          unitPrice: Number(unitPrice) || 0,
        })
      }
      setDescription('')
      setUnitPrice('')
      setQty('1')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '細項儲存失敗')
    }
  }

  async function doExport(format: 'pdf' | 'csv' | 'print') {
    setActionError(null)
    try {
      const { version } = await exportVersion(format)
      const snap = version.snapshot
      if (format === 'csv') {
        downloadTextFile(
          `${snap.quoteNumber}-v${snap.versionNo}.csv`,
          buildQuoteCsv(snap),
          'text/csv;charset=utf-8',
        )
      } else {
        const html = buildQuotePrintHtml(snap)
        if (format === 'pdf') {
          downloadTextFile(
            `${snap.quoteNumber}-v${snap.versionNo}.html`,
            html,
            'text/html;charset=utf-8',
          )
          openPrintWindow(html)
        } else {
          openPrintWindow(html)
        }
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '匯出失敗')
    }
  }

  async function reExportLatest() {
    setActionError(null)
    try {
      const latest = versions[0]
      if (latest) {
        openPrintWindow(buildQuotePrintHtml(latest.snapshot))
      } else {
        await doExport('pdf')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '重新匯出失敗')
    }
  }

  if (isLoading) {
    return (
      <div className="panel">
        <p className="muted">載入報價案件…</p>
      </div>
    )
  }
  if (!quote) {
    return (
      <div className="panel stack">
        <p>{(error as Error)?.message || '找不到報價案件'}</p>
        <Link to="/quotes">返回列表</Link>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <Link to="/quotes" className="btn btn-ghost">
            ← 案件列表
          </Link>
          <span className="badge steel">
            {QUOTE_WORKFLOW_LABELS[quote.workflowStatus]}
          </span>
        </div>
        <h2 style={{ margin: 0 }}>{quote.title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {quote.quoteNumber}
          {quote.currentVersion > 0 ? ` · 最新版本 v${quote.currentVersion}` : ''}
          <br />
          客戶接受：{CUSTOMER_ACCEPT_LABELS[quote.workflowStatus]}
          <br />
          更新：{formatTaipei(quote.updatedAt, 'yyyy/MM/dd HH:mm')}
        </p>
      </section>

      <section className="panel stack" id="export-panel">
        <strong>匯出（主要操作）</strong>
        <p className="muted" style={{ margin: 0 }}>
          每次匯出會建立不可覆寫的版本快照；凍結僅保護歷史版本。
        </p>
        {canExport ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-steel"
              disabled={saving}
              onClick={() => void doExport('pdf')}
            >
              匯出 PDF
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => void doExport('csv')}
            >
              匯出 Excel／CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => void doExport('print')}
            >
              列印
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => void reExportLatest()}
            >
              下載／重新匯出最新版本
            </button>
          </div>
        ) : (
          <p className="muted">匯出正式版本需老闆／管理員權限</p>
        )}
        {canMark ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() =>
                void setStatus('sent_to_customer').catch((e: unknown) =>
                  setActionError(e instanceof Error ? e.message : '失敗'),
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
                void setStatus('accepted').catch((e: unknown) =>
                  setActionError(e instanceof Error ? e.message : '失敗'),
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
                void setStatus('rejected').catch((e: unknown) =>
                  setActionError(e instanceof Error ? e.message : '失敗'),
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
                void setStatus('cancelled').catch((e: unknown) =>
                  setActionError(e instanceof Error ? e.message : '失敗'),
                )
              }
            >
              取消案件
            </button>
          </div>
        ) : null}
        {versions.length > 0 ? (
          <div className="stack">
            <strong>歷史版本（不可覆寫）</strong>
            {versions.map((v) => (
              <div key={v.id} className="row between">
                <span>
                  v{v.versionNo} · {formatTaipei(v.exportedAt, 'MM/dd HH:mm')} ·{' '}
                  {v.exportFormat}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => openPrintWindow(buildQuotePrintHtml(v.snapshot))}
                >
                  查看
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>案件／客戶／工地</strong>
        <form className="stack" onSubmit={(e) => void saveMeta(e)}>
          <div className="field">
            <label htmlFor="d-title">案件名稱</label>
            <input
              id="d-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              required
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="d-customer">客戶名稱</label>
              <input
                id="d-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label htmlFor="d-addr">工地地址</label>
              <input
                id="d-addr"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="d-tax">稅務</label>
              <select
                id="d-tax"
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                disabled={!canEdit}
              >
                <option value="exclusive">未稅＋另計稅</option>
                <option value="inclusive">含稅</option>
                <option value="zero">免稅</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-discount">折扣</label>
              <input
                id="d-discount"
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="d-pay">付款方式</label>
              <input
                id="d-pay"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label htmlFor="d-valid">有效期限</label>
              <input
                id="d-valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="d-notes">備註</label>
            <textarea
              id="d-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
              rows={3}
            />
          </div>
          {canEdit ? (
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              儲存案件資料
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel stack">
        <strong>報價細項</strong>
        {items.length === 0 ? (
          <div className="empty">尚無細項</div>
        ) : (
          <div className="stack">
            {items.map((item, index) => (
              <div key={item.id} className="site-link stack">
                <div className="row between">
                  <strong>
                    #{item.lineNo} {QUOTE_ITEM_KIND_LABELS[item.kind]} ·{' '}
                    {item.description}
                  </strong>
                  {canEdit ? (
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={saving || index === 0}
                        onClick={() => {
                          const ids = items.map((i) => i.id)
                          ;[ids[index - 1], ids[index]] = [
                            ids[index],
                            ids[index - 1],
                          ]
                          void reorderItems(ids)
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={saving || index === items.length - 1}
                        onClick={() => {
                          const ids = items.map((i) => i.id)
                          ;[ids[index + 1], ids[index]] = [
                            ids[index],
                            ids[index + 1],
                          ]
                          void reorderItems(ids)
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditingId(item.id)
                          setKind(item.kind)
                          setDescription(item.description)
                          setQty(String(item.qty))
                          setUnit(item.unit)
                          setUnitPrice(String(item.unitPrice))
                        }}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={saving}
                        onClick={() =>
                          void removeItem(item.id).catch((e: unknown) =>
                            setActionError(
                              e instanceof Error ? e.message : '刪除失敗',
                            ),
                          )
                        }
                      >
                        刪除
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {item.qty} {item.unit} × NT${item.unitPrice.toLocaleString()} ={' '}
                  NT${item.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {canEdit ? (
          <form className="stack" onSubmit={(e) => void submitItem(e)}>
            <strong>{editingId ? '編輯細項' : '新增細項'}</strong>
            <div className="grid-2">
              <div className="field">
                <label>類型</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as QuotationItemKind)}
                >
                  <option value="material">材料</option>
                  <option value="labor">工資</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div className="field">
                <label>單位</label>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} />
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
            <div className="grid-2">
              <div className="field">
                <label>數量</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>單價</label>
                <input
                  type="number"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-steel" type="submit" disabled={saving}>
                {editingId ? '更新細項' : '加入細項'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingId(null)
                    setDescription('')
                    setUnitPrice('')
                  }}
                >
                  取消編輯
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>金額摘要</strong>
        <p style={{ margin: 0 }}>
          小計 NT${totals.subtotal.toLocaleString()}
          <br />
          折扣 NT${totals.discount.toLocaleString()}
          <br />
          稅額 NT${totals.taxAmount.toLocaleString()}
          <br />
          <strong>總金額 NT${totals.total.toLocaleString()}</strong>
        </p>
        {quote.workflowStatus === 'accepted' ? (
          <p className="muted" style={{ margin: 0 }}>
            已計入有效合約金額
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            目前狀態不計入有效合約金額
          </p>
        )}
      </section>

      {actionError ? (
        <p style={{ color: 'var(--danger)' }}>{actionError}</p>
      ) : null}
    </div>
  )
}
