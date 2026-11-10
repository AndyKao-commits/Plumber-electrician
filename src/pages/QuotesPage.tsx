import { useState, type FormEvent } from 'react'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  calcQuoteItemAmount,
  calcQuoteTax,
  QUOTE_ITEM_KIND_LABELS,
  sumQuoteItems,
} from '@/domain/rules'
import type { Quotation, QuotationItemKind, TaxMode } from '@/domain/types'
import { useQuoteItems, useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

function QuoteCard(props: {
  quote: Quotation
  canPublish: boolean
  onPublish: (id: string) => Promise<unknown>
  onAddItem: (input: {
    quotationId: string
    kind: QuotationItemKind
    description: string
    qty: number
    unit?: string
    unitPrice: number
  }) => Promise<unknown>
  onRemoveItem: (input: {
    itemId: string
    quotationId: string
  }) => Promise<unknown>
  saving: boolean
}) {
  const { quote } = props
  const { data: items = [], isLoading } = useQuoteItems(quote.id)
  const [kind, setKind] = useState<QuotationItemKind>('material')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('式')
  const [unitPrice, setUnitPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const editable = quote.status === 'draft' && !quote.frozen
  const breakdown = sumQuoteItems(items)

  async function addItem(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await props.onAddItem({
        quotationId: quote.id,
        kind,
        description,
        qty: Number(qty) || 0,
        unit,
        unitPrice: Number(unitPrice) || 0,
      })
      setDescription('')
      setUnitPrice('')
      setQty('1')
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗')
    }
  }

  return (
    <div className="site-link stack">
      <div className="row between">
        <span className="badge steel">{quote.taxMode}</span>
        <span className="badge">{quote.status}</span>
      </div>
      <h3 style={{ margin: 0 }}>{quote.title}</h3>
      <p style={{ margin: 0 }}>
        NT${quote.amountAfterTax.toLocaleString()} ·{' '}
        {formatTaipei(quote.createdAt, 'MM/dd HH:mm')}
        {quote.frozen ? ' · 已凍結' : ''}
      </p>
      <p className="muted" style={{ margin: 0 }}>
        材料 NT${breakdown.byKind.material.toLocaleString()} · 工資 NT$
        {breakdown.byKind.labor.toLocaleString()} · 其他 NT$
        {breakdown.byKind.other.toLocaleString()}
      </p>

      {isLoading ? <p className="muted">載入細項…</p> : null}
      {items.length === 0 ? (
        <div className="empty">尚無細項（材料／工資分開列示，合計只加總一次）</div>
      ) : (
        <div className="stack">
          {items.map((item) => (
            <div key={item.id} className="row between" style={{ gap: 8 }}>
              <div>
                <strong>
                  {QUOTE_ITEM_KIND_LABELS[item.kind]} · {item.description}
                </strong>
                <p className="muted" style={{ margin: 0 }}>
                  {item.qty} {item.unit} × NT${item.unitPrice.toLocaleString()} ={' '}
                  NT${item.amount.toLocaleString()}
                </p>
              </div>
              {editable ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={props.saving}
                  onClick={() =>
                    void props
                      .onRemoveItem({ itemId: item.id, quotationId: quote.id })
                      .catch((e: unknown) =>
                        setError(e instanceof Error ? e.message : '刪除失敗'),
                      )
                  }
                >
                  刪除
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editable ? (
        <form className="stack" onSubmit={(e) => void addItem(e)}>
          <strong>新增細項</strong>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`kind-${quote.id}`}>類型</label>
              <select
                id={`kind-${quote.id}`}
                value={kind}
                onChange={(e) => setKind(e.target.value as QuotationItemKind)}
              >
                <option value="material">材料</option>
                <option value="labor">工資</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`unit-${quote.id}`}>單位</label>
              <input
                id={`unit-${quote.id}`}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="式／米／工"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`desc-${quote.id}`}>說明</label>
            <input
              id={`desc-${quote.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="例如：PVC 管 4 分"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`qty-${quote.id}`}>數量</label>
              <input
                id={`qty-${quote.id}`}
                type="number"
                min="0"
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor={`price-${quote.id}`}>單價</label>
              <input
                id={`price-${quote.id}`}
                type="number"
                min="0"
                step="1"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            小計 NT$
            {calcQuoteItemAmount({
              qty: Number(qty) || 0,
              unitPrice: Number(unitPrice) || 0,
            }).toLocaleString()}
          </p>
          {error ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
          ) : null}
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={props.saving || !description.trim()}
          >
            {props.saving ? '儲存中…' : '加入細項'}
          </button>
        </form>
      ) : null}

      {quote.status === 'draft' && props.canPublish ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            void props.onPublish(quote.id).catch((e: unknown) =>
              setError(e instanceof Error ? e.message : '發布失敗'),
            )
          }
        >
          發布並凍結稅務
        </button>
      ) : null}
    </div>
  )
}

export function QuotesPage() {
  const { user } = useUser()
  const { sites } = useSites()
  const {
    quotes,
    repairCases,
    createQuote,
    isCreating,
    createError,
    publishQuote,
    createRepairCase,
    isCreatingRepair,
    createRepairError,
    addQuoteItem,
    removeQuoteItem,
    isSavingItem,
  } = useQuotes(user?.id)
  const canPublish =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.QUOTE_PUBLISH)

  const formalSites = sites.filter((s) => s.kind === 'formal')

  const [title, setTitle] = useState('')
  const [linkType, setLinkType] = useState<'project' | 'repair'>('project')
  const [projectId, setProjectId] = useState('')
  const [repairCaseId, setRepairCaseId] = useState('')
  const [taxMode, setTaxMode] = useState<TaxMode>('exclusive')
  const [formError, setFormError] = useState<string | null>(null)
  const [repairTitle, setRepairTitle] = useState('')
  const [repairCustomer, setRepairCustomer] = useState('')
  const [repairSiteId, setRepairSiteId] = useState('')

  const selectedProjectId =
    projectId && formalSites.some((s) => s.id === projectId)
      ? projectId
      : (formalSites[0]?.id ?? '')
  const selectedRepairId =
    repairCaseId && repairCases.some((r) => r.id === repairCaseId)
      ? repairCaseId
      : (repairCases[0]?.id ?? '')

  const preview = calcQuoteTax({
    amountBeforeTax: 0,
    taxMode,
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const nextProjectId = linkType === 'project' ? selectedProjectId : null
    const nextRepairId = linkType === 'repair' ? selectedRepairId : null

    if (linkType === 'project' && !nextProjectId) {
      setFormError('請先選擇正式工程（尚無可用工地）')
      return
    }
    if (linkType === 'repair' && !nextRepairId) {
      setFormError('請先選擇維修案件（尚無可用案件）')
      return
    }

    await createQuote({
      title,
      taxMode,
      amountBeforeTax: 0,
      projectId: nextProjectId,
      repairCaseId: nextRepairId,
    })
    setTitle('')
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>報價</strong>
        <p className="muted" style={{ margin: 0 }}>
          建立時必須選擇稅務模式（REV-03）；必須恰好關聯工程或維修案件其一（REV-01）。
          細項可拆材料／工資（FIN-02），合計只加總一次；發布後凍結。
        </p>
      </section>

      <section className="panel stack">
        <strong>建立維修案件</strong>
        <p className="muted" style={{ margin: 0 }}>
          報價若選「維修案件」需先有案件；可選掛到既有工地。
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void createRepairCase({
              title: repairTitle,
              customerName: repairCustomer,
              siteId: repairSiteId || null,
            }).then(() => {
              setRepairTitle('')
              setRepairCustomer('')
              setRepairSiteId('')
            })
          }}
        >
          <div className="field">
            <label htmlFor="repair-title">標題</label>
            <input
              id="repair-title"
              value={repairTitle}
              onChange={(e) => setRepairTitle(e.target.value)}
              required
              placeholder="例如：廚房漏水急修"
            />
          </div>
          <div className="field">
            <label htmlFor="repair-customer">客戶</label>
            <input
              id="repair-customer"
              value={repairCustomer}
              onChange={(e) => setRepairCustomer(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="repair-site">關聯工地（選填）</label>
            <select
              id="repair-site"
              value={repairSiteId}
              onChange={(e) => setRepairSiteId(e.target.value)}
            >
              <option value="">不指定</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {createRepairError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {createRepairError.message}
            </p>
          ) : null}
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={
              isCreatingRepair || !repairTitle.trim() || !repairCustomer.trim()
            }
          >
            {isCreatingRepair ? '建立中…' : '新增維修案件'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>建立報價草稿</strong>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label htmlFor="q-title">標題</label>
            <input
              id="q-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：浴室整修報價"
              required
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="q-link">關聯類型</label>
              <select
                id="q-link"
                value={linkType}
                onChange={(e) =>
                  setLinkType(e.target.value as 'project' | 'repair')
                }
              >
                <option value="project">正式工程</option>
                <option value="repair">維修案件</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="q-tax">稅務模式</label>
              <select
                id="q-tax"
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                required
              >
                <option value="exclusive">未稅＋另計稅</option>
                <option value="inclusive">含稅</option>
                <option value="zero">免稅／零稅率</option>
              </select>
            </div>
          </div>
          {linkType === 'project' ? (
            <div className="field">
              <label htmlFor="q-project">工程</label>
              <select
                id="q-project"
                value={selectedProjectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                disabled={formalSites.length === 0}
              >
                {formalSites.length === 0 ? (
                  <option value="">尚無正式工程</option>
                ) : null}
                {formalSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="q-repair">維修案件</label>
              <select
                id="q-repair"
                value={selectedRepairId}
                onChange={(e) => setRepairCaseId(e.target.value)}
                required
                disabled={repairCases.length === 0}
              >
                {repairCases.length === 0 ? (
                  <option value="">尚無維修案件</option>
                ) : null}
                {repairCases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}（{r.customerName}）
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="muted" style={{ margin: 0 }}>
            金額由細項加總；建立後請新增材料／工資列。目前稅率預覽：稅額 NT$
            {preview.taxAmount.toLocaleString()}（細項為 0 時）。
          </p>
          {formError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
          ) : null}
          {createError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel btn-block"
            type="submit"
            disabled={
              isCreating ||
              (linkType === 'project'
                ? formalSites.length === 0
                : repairCases.length === 0)
            }
          >
            {isCreating ? '建立中…' : '建立報價草稿'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>報價列表</strong>
        {quotes.length === 0 ? (
          <div className="empty">尚無報價</div>
        ) : (
          quotes.map((q) => (
            <QuoteCard
              key={q.id}
              quote={q}
              canPublish={canPublish}
              onPublish={publishQuote}
              onAddItem={addQuoteItem}
              onRemoveItem={removeQuoteItem}
              saving={isSavingItem}
            />
          ))
        )}
      </section>
    </div>
  )
}
