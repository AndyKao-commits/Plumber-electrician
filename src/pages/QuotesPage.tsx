import { useState, type FormEvent } from 'react'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import { calcQuoteTax } from '@/domain/rules'
import type { TaxMode } from '@/domain/types'
import { useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

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
  } = useQuotes(user?.id)
  const canPublish =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.QUOTE_PUBLISH)

  const [title, setTitle] = useState('')
  const [linkType, setLinkType] = useState<'project' | 'repair'>('project')
  const [projectId, setProjectId] = useState('site-a')
  const [repairCaseId, setRepairCaseId] = useState('repair-1')
  const [taxMode, setTaxMode] = useState<TaxMode>('exclusive')
  const [amount, setAmount] = useState('10000')

  const preview = calcQuoteTax({
    amountBeforeTax: Number(amount) || 0,
    taxMode,
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await createQuote({
      title,
      taxMode,
      amountBeforeTax: Number(amount) || 0,
      projectId: linkType === 'project' ? projectId : null,
      repairCaseId: linkType === 'repair' ? repairCaseId : null,
    })
    setTitle('')
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>報價</strong>
        <p className="muted" style={{ margin: 0 }}>
          建立時必須選擇稅務模式（REV-03）；必須恰好關聯工程或維修案件其一（REV-01）。
          發布後稅務快照凍結。
        </p>
      </section>

      <section className="panel stack">
        <strong>建立報價</strong>
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
                onChange={(e) => setLinkType(e.target.value as 'project' | 'repair')}
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
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {sites
                  .filter((s) => s.kind === 'formal')
                  .map((s) => (
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
                value={repairCaseId}
                onChange={(e) => setRepairCaseId(e.target.value)}
              >
                {repairCases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}（{r.customerName}）
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="q-amount">金額（稅前／含稅依模式）</label>
            <input
              id="q-amount"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="site-link">
            <p>稅額／含稅合計</p>
            <h3>
              NT${preview.taxAmount.toLocaleString()} /{' '}
              {preview.amountAfterTax.toLocaleString()}
            </h3>
          </div>
          {createError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createError as Error).message}
            </p>
          ) : null}
          <button className="btn btn-steel btn-block" type="submit" disabled={isCreating}>
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
            <div key={q.id} className="site-link stack">
              <div className="row between">
                <span className="badge steel">{q.taxMode}</span>
                <span className="badge">{q.status}</span>
              </div>
              <h3 style={{ margin: 0 }}>{q.title}</h3>
              <p style={{ margin: 0 }}>
                NT${q.amountAfterTax.toLocaleString()} ·{' '}
                {formatTaipei(q.createdAt, 'MM/dd HH:mm')}
                {q.frozen ? ' · 已凍結' : ''}
              </p>
              {q.status === 'draft' && canPublish ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void publishQuote(q.id)}
                >
                  發布並凍結稅務
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
