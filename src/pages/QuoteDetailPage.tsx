import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  canSoftDeleteQuoteCase,
  canSoftDeleteQuoteVersion,
} from '@/domain/quoteDelete'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  CUSTOMER_ACCEPT_LABELS,
  QUOTE_WORKFLOW_LABELS,
  calcQuoteTotals,
  isQuoteEditable,
} from '@/domain/quoteWorkflow'
import { QUOTE_ITEM_KIND_LABELS } from '@/domain/rules'
import type {
  QuoteExportSnapshot,
  QuotationItemKind,
  TaxMode,
} from '@/domain/types'
import { useQuoteDetail } from '@/hooks/useQuotes'
import { useUser } from '@/hooks/useUser'
import {
  buildQuoteCsv,
  buildQuotePrintHtml,
  downloadBlob,
  downloadTextFile,
  generateQuotePdfBlob,
  printHtmlDocument,
  quotePdfFilename,
} from '@/lib/quoteExport'
import { formatTaipei } from '@/lib/time'
import { BillingPanel } from '@/pages/BillingPanel'
import { ChangeOrdersPanel } from '@/pages/ChangeOrdersPanel'
import { PaymentsPanel } from '@/pages/PaymentsPanel'

export function QuoteDetailPage() {
  const { quoteId = '' } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const {
    quote,
    items,
    versions,
    changeOrders,
    isLoading,
    error,
    updateMeta,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    exportVersion,
    setStatus,
    softDeleteVersion,
    softDeleteCase,
    createChangeOrder,
    addChangeOrderItem,
    removeChangeOrderItem,
    setChangeOrderStatus,
    listChangeOrderItems,
    billingMilestones,
    billingDocuments,
    createBillingMilestone,
    createBillingDocument,
    issueBillingDocument,
    payments,
    paymentAllocations,
    advances,
    advanceApplications,
    createCustomerPayment,
    allocatePayment,
    createCustomerAdvance,
    applyCustomerAdvance,
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
  const canDelete =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.QUOTE_DELETE)

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
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

  function pdfOptions() {
    return {
      contactPhone: quote?.customerPhone ?? null,
      constructionNotes: quote?.constructionNotes ?? null,
    }
  }

  function assertQuoteReadyForExport() {
    if (!quote) throw new Error('案件資料尚未載入，請稍後再試')
    if (isLoading) throw new Error('報價資料載入中，請稍後再試')
    if (typeof quote.amountAfterTax !== 'number') {
      throw new Error('總金額尚未就緒，請重新整理後再試')
    }
  }

  async function renderPdfDownload(snapshot: QuoteExportSnapshot) {
    const blob = await generateQuotePdfBlob(snapshot, pdfOptions())
    downloadBlob(quotePdfFilename(snapshot), blob)
  }

  async function renderPrint(snapshot: QuoteExportSnapshot) {
    const html = buildQuotePrintHtml(snapshot, pdfOptions())
    await printHtmlDocument(html)
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault()
    setActionError(null)
    setActionSuccess(null)
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
      setActionSuccess('案件資料已儲存')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '儲存失敗')
    }
  }

  async function submitItem(e: FormEvent) {
    e.preventDefault()
    setActionError(null)
    setActionSuccess(null)
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
    setActionSuccess(null)
    setExporting(true)
    try {
      assertQuoteReadyForExport()
      const { version } = await exportVersion(format)
      const snap = version.snapshot
      if (format === 'csv') {
        downloadTextFile(
          quotePdfFilename(snap).replace(/\.pdf$/i, '.csv'),
          buildQuoteCsv(snap),
          'text/csv;charset=utf-8',
        )
        setActionSuccess('CSV 已下載')
      } else if (format === 'pdf') {
        await renderPdfDownload(snap)
        setActionSuccess('PDF 已產生並開始下載')
      } else {
        await renderPrint(snap)
        setActionSuccess('已開啟列印預覽')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  async function downloadLatestPdf() {
    setActionError(null)
    setActionSuccess(null)
    setExporting(true)
    try {
      assertQuoteReadyForExport()
      const latest = versions[0]
      if (latest) {
        await renderPdfDownload(latest.snapshot)
        setActionSuccess('最新版本 PDF 已下載')
        return
      }
      const { version } = await exportVersion('pdf')
      await renderPdfDownload(version.snapshot)
      setActionSuccess('PDF 已產生並開始下載')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '下載失敗')
    } finally {
      setExporting(false)
    }
  }

  async function viewVersion(
    snapshot: QuoteExportSnapshot,
    mode: 'pdf' | 'print',
  ) {
    setActionError(null)
    setActionSuccess(null)
    setExporting(true)
    try {
      if (mode === 'pdf') {
        await renderPdfDownload(snapshot)
        setActionSuccess('版本 PDF 已下載')
      } else {
        await renderPrint(snapshot)
        setActionSuccess('已開啟列印預覽')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '開啟失敗')
    } finally {
      setExporting(false)
    }
  }

  function confirmDeleteVersion(v: {
    id: string
    versionNo: number
    exportedAt: string
    snapshot: QuoteExportSnapshot
  }) {
    if (!user || !quote) return
    const gate = canSoftDeleteQuoteVersion(user.role, quote, v)
    if (!gate.ok) {
      setActionError(gate.reason)
      return
    }
    const amount = `NT$ ${Number(v.snapshot.total || 0).toLocaleString('zh-TW')}`
    const when = formatTaipei(v.exportedAt, 'yyyy/MM/dd HH:mm')
    const ok = window.confirm(
      `確定要刪除報價版本 v${v.versionNo} 嗎？刪除後將無法在一般列表中查看。\n\n建立時間：${when}\n金額：${amount}`,
    )
    if (!ok) return
    setActionError(null)
    setActionSuccess(null)
    void softDeleteVersion({ versionId: v.id })
      .then(() => setActionSuccess(`已刪除版本 v${v.versionNo}`))
      .catch((e: unknown) =>
        setActionError(e instanceof Error ? e.message : '刪除版本失敗'),
      )
  }

  function confirmDeleteCase() {
    if (!user || !quote) return
    const gate = canSoftDeleteQuoteCase(user.role, quote)
    if (!gate.ok) {
      setActionError(gate.reason)
      return
    }
    const amount = `NT$ ${Number(quote.amountAfterTax || 0).toLocaleString('zh-TW')}`
    const ok = window.confirm(
      `確定要刪除這個報價案件嗎？\n\n案件：${quote.title}\n客戶：${quote.customerName || '—'}\n目前報價金額：${amount}\n\n刪除後案件會從一般列表隱藏，但系統會保留稽核紀錄。`,
    )
    if (!ok) return
    const ok2 = window.confirm(
      '再次確認：刪除後案件會從一般列表隱藏，但系統會保留稽核紀錄。確定刪除？',
    )
    if (!ok2) return
    setActionError(null)
    setActionSuccess(null)
    void softDeleteCase()
      .then(() => {
        navigate('/quotes', { replace: true })
      })
      .catch((e: unknown) =>
        setActionError(e instanceof Error ? e.message : '刪除案件失敗'),
      )
  }

  const busy = saving || exporting

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

  const caseDeleteGate = user
    ? canSoftDeleteQuoteCase(user.role, quote)
    : { ok: false as const, reason: '尚未登入' }

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
        {canDelete ? (
          <div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || !caseDeleteGate.ok}
              title={!caseDeleteGate.ok ? caseDeleteGate.reason : undefined}
              onClick={() => confirmDeleteCase()}
            >
              刪除案件
            </button>
            {!caseDeleteGate.ok ? (
              <p className="muted" style={{ margin: '6px 0 0' }}>
                {caseDeleteGate.reason}
              </p>
            ) : null}
          </div>
        ) : null}
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
              disabled={busy}
              onClick={() => void doExport('pdf')}
            >
              {exporting ? '匯出中…' : '匯出 PDF'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void doExport('csv')}
            >
              匯出 Excel／CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void doExport('print')}
            >
              列印
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void downloadLatestPdf()}
            >
              下載最新版本 PDF
            </button>
          </div>
        ) : (
          <p className="muted">匯出正式版本需老闆／管理員權限</p>
        )}
        {exporting ? <p className="muted">正在產生報價單，請稍候…</p> : null}
        {canMark ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
            {versions.map((v) => {
              const vGate = user
                ? canSoftDeleteQuoteVersion(user.role, quote, v)
                : { ok: false as const, reason: '尚未登入' }
              return (
                <div key={v.id} className="row between" style={{ gap: 8 }}>
                  <span>
                    v{v.versionNo} · {formatTaipei(v.exportedAt, 'MM/dd HH:mm')}{' '}
                    · {v.exportFormat} · NT${' '}
                    {Number(v.snapshot.total || 0).toLocaleString('zh-TW')}
                  </span>
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void viewVersion(v.snapshot, 'pdf')}
                    >
                      下載 PDF
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void viewVersion(v.snapshot, 'print')}
                    >
                      列印
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy || !vGate.ok}
                        title={!vGate.ok ? vGate.reason : undefined}
                        onClick={() => confirmDeleteVersion(v)}
                      >
                        刪除
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
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
            <button className="btn btn-ghost" type="submit" disabled={busy}>
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
                        disabled={busy || index === 0}
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
                        disabled={busy || index === items.length - 1}
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
                        disabled={busy}
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
              <button className="btn btn-steel" type="submit" disabled={busy}>
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

      <ChangeOrdersPanel
        quote={quote}
        changeOrders={changeOrders}
        userRole={user?.role || 'member'}
        saving={busy}
        createChangeOrder={createChangeOrder}
        addChangeOrderItem={addChangeOrderItem}
        removeChangeOrderItem={removeChangeOrderItem}
        setChangeOrderStatus={setChangeOrderStatus}
        listChangeOrderItems={listChangeOrderItems}
        onError={setActionError}
        onSuccess={setActionSuccess}
      />

      <BillingPanel
        quote={quote}
        changeOrders={changeOrders}
        milestones={billingMilestones}
        documents={billingDocuments}
        userRole={user?.role || 'member'}
        saving={busy}
        createBillingMilestone={createBillingMilestone}
        createBillingDocument={createBillingDocument}
        issueBillingDocument={issueBillingDocument}
        onError={setActionError}
        onSuccess={setActionSuccess}
      />

      <PaymentsPanel
        quote={quote}
        billingDocuments={billingDocuments}
        payments={payments}
        allocations={paymentAllocations}
        advances={advances}
        advanceApplications={advanceApplications}
        userRole={user?.role || 'member'}
        saving={busy}
        createCustomerPayment={createCustomerPayment}
        allocatePayment={allocatePayment}
        createCustomerAdvance={createCustomerAdvance}
        applyCustomerAdvance={applyCustomerAdvance}
        onError={setActionError}
        onSuccess={setActionSuccess}
      />

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
            已計入有效合約金額（追加減另計，僅已接受才加減）
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            目前狀態不計入有效合約金額
          </p>
        )}
      </section>

      {actionSuccess ? (
        <p style={{ color: 'var(--ok, #0a7a3e)' }}>{actionSuccess}</p>
      ) : null}
      {actionError ? (
        <p style={{ color: 'var(--danger)' }}>{actionError}</p>
      ) : null}
    </div>
  )
}
