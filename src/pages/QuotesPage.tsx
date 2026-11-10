import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import { sumIssuedBillingAmount } from '@/domain/billing'
import { effectiveContractAmountWithChangeOrders } from '@/domain/changeOrders'
import {
  CUSTOMER_ACCEPT_LABELS,
  QUOTE_WORKFLOW_LABELS,
} from '@/domain/quoteWorkflow'
import type { TaxMode } from '@/domain/types'
import { useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function QuotesPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { sites } = useSites()
  const {
    quotes,
    changeOrders,
    billingDocuments,
    isLoading,
    repairCases,
    createQuote,
    isCreating,
    createError,
    createRepairCase,
    isCreatingRepair,
    createRepairError,
  } = useQuotes(user?.id)

  const canCreate =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.QUOTE_CREATE)
  const canExport =
    Boolean(user) &&
    (hasPermission(user!.role, PERMISSIONS.QUOTE_EXPORT) ||
      hasPermission(user!.role, PERMISSIONS.QUOTE_PUBLISH))

  const formalSites = sites.filter((s) => s.kind === 'formal')
  const contractTotal = useMemo(
    () =>
      effectiveContractAmountWithChangeOrders({
        quotes,
        changeOrders,
      }),
    [quotes, changeOrders],
  )
  const billedTotal = useMemo(
    () => sumIssuedBillingAmount(billingDocuments),
    [billingDocuments],
  )

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
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

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const nextProjectId = linkType === 'project' ? selectedProjectId : null
    const nextRepairId = linkType === 'repair' ? selectedRepairId : null
    if (linkType === 'project' && !nextProjectId) {
      setFormError('請先選擇正式工程')
      return
    }
    if (linkType === 'repair' && !nextRepairId) {
      setFormError('請先選擇維修案件')
      return
    }
    const site = formalSites.find((s) => s.id === nextProjectId)
    const repair = repairCases.find((r) => r.id === nextRepairId)
    const created = await createQuote({
      title,
      taxMode,
      projectId: nextProjectId,
      repairCaseId: nextRepairId,
      customerName:
        customerName ||
        repair?.customerName ||
        site?.customerName ||
        '',
      siteAddress: siteAddress || site?.address || '',
    })
    setTitle('')
    setCustomerName('')
    setSiteAddress('')
    setShowCreate(false)
    navigate(`/quotes/${created.id}`)
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>報價案件</strong>
        <p className="muted" style={{ margin: 0 }}>
          以案件為中心：編輯細項 → 匯出 → 客戶接受後計入合約；追加減僅「已接受」才加減合約金額。
        </p>
        <div className="site-link">
          <p>有效合約金額（已接受報價 ± 已接受追加減）</p>
          <h3>NT${contractTotal.toLocaleString()}</h3>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            已開立請款 NT${billedTotal.toLocaleString()}（≠ 收款）
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="btn btn-steel"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? '收合建立表單' : '新增報價案件'}
          </button>
        ) : null}
      </section>

      {showCreate ? (
        <section className="panel stack">
          <strong>新增報價案件</strong>
          <form className="stack" onSubmit={(e) => void onCreate(e)}>
            <div className="field">
              <label htmlFor="q-title">案件名稱</label>
              <input
                id="q-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="例如：浴室整修報價"
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="q-customer">客戶名稱</label>
                <input
                  id="q-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="可之後再補"
                />
              </div>
              <div className="field">
                <label htmlFor="q-addr">工地地址</label>
                <input
                  id="q-addr"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                />
              </div>
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
                  onChange={(e) => {
                    setProjectId(e.target.value)
                    const s = formalSites.find((x) => x.id === e.target.value)
                    if (s) {
                      if (!customerName) setCustomerName(s.customerName || '')
                      if (!siteAddress) setSiteAddress(s.address || '')
                    }
                  }}
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
                  onChange={(e) => {
                    setRepairCaseId(e.target.value)
                    const r = repairCases.find((x) => x.id === e.target.value)
                    if (r && !customerName) setCustomerName(r.customerName || '')
                  }}
                  required
                  disabled={repairCases.length === 0}
                >
                  {repairCases.length === 0 ? (
                    <option value="">尚無維修案件</option>
                  ) : null}
                  {repairCases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.problemDescription || r.title}
                      {r.customerName ? `（${r.customerName}）` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              disabled={isCreating}
            >
              {isCreating ? '建立中…' : '建立並進入案件'}
            </button>
          </form>

          <details>
            <summary>建立維修案件</summary>
            <form
              className="stack"
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault()
                void createRepairCase({
                  problemDescription: repairTitle,
                  customerName: repairCustomer || null,
                  siteId: repairSiteId || null,
                }).then(() => {
                  setRepairTitle('')
                  setRepairCustomer('')
                  setRepairSiteId('')
                })
              }}
            >
              <div className="field">
                <label htmlFor="repair-title">問題描述（必填）</label>
                <input
                  id="repair-title"
                  value={repairTitle}
                  onChange={(e) => setRepairTitle(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="repair-customer">客戶（選填）</label>
                <input
                  id="repair-customer"
                  value={repairCustomer}
                  onChange={(e) => setRepairCustomer(e.target.value)}
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
                disabled={isCreatingRepair}
              >
                新增維修案件
              </button>
            </form>
          </details>
        </section>
      ) : null}

      <section className="panel stack">
        <strong>案件列表</strong>
        {isLoading ? <p className="muted">載入中…</p> : null}
        {quotes.length === 0 ? (
          <div className="empty">尚無報價案件</div>
        ) : (
          <div className="stack">
            {quotes.map((q) => (
              <div key={q.id} className="site-link stack">
                <div className="row between">
                  <span className="badge steel">
                    {QUOTE_WORKFLOW_LABELS[q.workflowStatus]}
                  </span>
                  <span className="badge">
                    {CUSTOMER_ACCEPT_LABELS[q.workflowStatus]}
                  </span>
                </div>
                <h3 style={{ margin: 0 }}>{q.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {q.quoteNumber}
                  {q.currentVersion > 0 ? ` · v${q.currentVersion}` : ''}
                </p>
                <p style={{ margin: 0 }}>
                  客戶：{q.customerName || '—'}
                  <br />
                  地址：{q.siteAddress || '—'}
                  <br />
                  總額：NT${q.amountAfterTax.toLocaleString()}
                  <br />
                  更新：{formatTaipei(q.updatedAt, 'MM/dd HH:mm')}
                </p>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Link className="btn btn-steel" to={`/quotes/${q.id}`}>
                    進入案件
                  </Link>
                  {canExport ? (
                    <Link className="btn btn-ghost" to={`/quotes/${q.id}?export=1`}>
                      匯出報價
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
