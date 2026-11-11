import { useState, type FormEvent } from 'react'
import { REPAIR_STATUS_LABELS } from '@/domain/repairs'
import { WARRANTY_ASSESSMENT_LABELS } from '@/domain/warranty'
import type {
  RepairCaseStatus,
  WarrantyAssessmentClassification,
} from '@/domain/types'
import { useInventory } from '@/hooks/useInventory'
import { useRepairs, useRepairHistory } from '@/hooks/useRepairs'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'
import { Link } from 'react-router-dom'

export function RepairsPage() {
  const { user } = useUser()
  const { sites } = useSites()
  const { materials } = useInventory(user?.id)
  const {
    repairs,
    isLoading,
    warranties,
    createRepair,
    assign,
    recordVisit,
    setStatus,
    createWarranty,
    assessWarranty,
    postUsage,
    quoteFromUsages,
    saving,
  } = useRepairs()

  const [showForm, setShowForm] = useState(false)
  const [problem, setProblem] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [siteId, setSiteId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignNote, setAssignNote] = useState('')
  const [visitNote, setVisitNote] = useState('')
  const [warTitle, setWarTitle] = useState('')
  const [warEnds, setWarEnds] = useState('')
  const [warExclusion, setWarExclusion] = useState('')
  const [assessClass, setAssessClass] =
    useState<WarrantyAssessmentClassification>('excluded')
  const [assessReason, setAssessReason] = useState('')
  const [assessWarId, setAssessWarId] = useState('')
  const [usageMaterialId, setUsageMaterialId] = useState('')
  const [usageQty, setUsageQty] = useState('1')
  const [usageNote, setUsageNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const history = useRepairHistory(selectedId ?? undefined)
  const selected = repairs.find((r) => r.id === selectedId) ?? null

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const r = await createRepair({
        problemDescription: problem,
        customerName: customerName || null,
        siteId: siteId || null,
      })
      setProblem('')
      setCustomerName('')
      setSiteId('')
      setShowForm(false)
      setSelectedId(r.id)
      setMessage('已建立維修（僅問題描述即可）')
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault()
    if (!selectedId || !user) return
    setError(null)
    try {
      await assign({
        repairCaseId: selectedId,
        assigneeUserId: user.id,
        assigneeName: user.name,
        note: assignNote || null,
      })
      setAssignNote('')
      setMessage('已登錄派工（歷史保留）')
      await history.refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : '派工失敗')
    }
  }

  async function onVisit(e: FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setError(null)
    try {
      const v = await recordVisit({
        repairCaseId: selectedId,
        note: visitNote || null,
      })
      setVisitNote('')
      setMessage(
        v.attendanceCreated
          ? '到場已記錄'
          : '已記錄到場（未建立出勤，REP-03）',
      )
      await history.refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : '到場失敗')
    }
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>維修案件（REP-001）</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              只需問題描述可建立；派工／到場歷史完整保留；到場≠出勤。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '取消' : '新增維修'}
          </button>
        </div>

        {showForm ? (
          <form className="stack" onSubmit={(e) => void onCreate(e)}>
            <div className="field">
              <label>問題描述（必填）</label>
              <input
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="例如：廚房水管漏水"
                required
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>客戶（選填）</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="field">
                <label>工地（選填）</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                >
                  <option value="">不指定</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-steel" type="submit" disabled={saving}>
              建立維修
            </button>
          </form>
        ) : null}

        {message ? (
          <p style={{ color: 'var(--ok, #0a7a3e)', margin: 0 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        ) : null}
      </section>

      <section className="stack">
        {isLoading ? <div className="empty">載入維修…</div> : null}
        {!isLoading && repairs.length === 0 ? (
          <div className="empty">尚無維修案件</div>
        ) : null}
        {repairs.map((r) => (
          <button
            key={r.id}
            type="button"
            className="panel"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              borderColor:
                selectedId === r.id ? 'var(--accent, #2a6)' : undefined,
            }}
            onClick={() => setSelectedId(r.id)}
          >
            <div className="row between">
              <strong>{r.problemDescription}</strong>
              <span className="badge steel">
                {REPAIR_STATUS_LABELS[r.status]}
              </span>
            </div>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {r.caseNumber}
              {r.customerName ? ` · ${r.customerName}` : ' · 未指定客戶'}
            </p>
          </button>
        ))}
      </section>

      {selected ? (
        <section className="panel stack">
          <strong>{selected.problemDescription}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {selected.caseNumber} · {REPAIR_STATUS_LABELS[selected.status]}
          </p>

          <div className="field">
            <label>狀態</label>
            <select
              value={selected.status}
              onChange={(e) => {
                void setStatus({
                  repairCaseId: selected.id,
                  status: e.target.value as RepairCaseStatus,
                })
              }}
              disabled={saving}
            >
              {(Object.keys(REPAIR_STATUS_LABELS) as RepairCaseStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {REPAIR_STATUS_LABELS[s]}
                  </option>
                ),
              )}
            </select>
          </div>

          <form className="stack" onSubmit={(e) => void onAssign(e)}>
            <strong>派工（可多次）</strong>
            <div className="field">
              <label>備註</label>
              <input
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder={`指派給 ${user?.name ?? ''}`}
              />
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              登錄派工給自己
            </button>
          </form>

          <div className="stack">
            {history.assignments.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無派工紀錄
              </p>
            ) : (
              history.assignments.map((a) => (
                <p key={a.id} style={{ margin: 0 }}>
                  {a.assigneeName}
                  {a.note ? ` · ${a.note}` : ''}
                  <br />
                  <span className="muted">
                    {formatTaipei(a.assignedAt, 'MM/dd HH:mm')}
                  </span>
                </p>
              ))
            )}
          </div>

          <form className="stack" onSubmit={(e) => void onVisit(e)}>
            <strong>到場紀錄（不產生出勤）</strong>
            <div className="field">
              <label>備註</label>
              <input
                value={visitNote}
                onChange={(e) => setVisitNote(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              記錄到場
            </button>
          </form>

          <div className="stack">
            {history.visits.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無到場紀錄
              </p>
            ) : (
              history.visits.map((v) => (
                <p key={v.id} style={{ margin: 0 }}>
                  {v.visitorName}
                  {v.note ? ` · ${v.note}` : ''}
                  {' · '}
                  <span className="muted">出勤未建立</span>
                  <br />
                  <span className="muted">
                    {formatTaipei(v.visitedAt, 'MM/dd HH:mm')}
                  </span>
                </p>
              ))
            )}
          </div>

          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                try {
                  await postUsage({
                    materialId: usageMaterialId,
                    qty: Number(usageQty) || 0,
                    repairCaseId: selected.id,
                    note: usageNote || null,
                  })
                  setUsageQty('1')
                  setUsageNote('')
                  setMessage('已過帳耗用（共用庫存，只扣一次）')
                  await history.refetch()
                } catch (err) {
                  setError(err instanceof Error ? err.message : '耗用失敗')
                }
              })()
            }}
          >
            <strong>維修材料耗用（REP-002）</strong>
            <p className="muted" style={{ margin: 0 }}>
              共用庫存流水帳；禁止負庫存；免費／保固仍記成本。可轉維修報價（無需工程）。
            </p>
            <div className="grid-2">
              <div className="field">
                <label>材料</label>
                <select
                  value={usageMaterialId}
                  onChange={(e) => setUsageMaterialId(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}（庫存 {m.qty} · 成本 {m.unitCost}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>數量</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={usageQty}
                  onChange={(e) => setUsageQty(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>備註</label>
              <input
                value={usageNote}
                onChange={(e) => setUsageNote(e.target.value)}
              />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" type="submit" disabled={saving}>
                過帳耗用
              </button>
              <button
                className="btn btn-steel"
                type="button"
                disabled={saving || history.usages.length === 0}
                onClick={() => {
                  void (async () => {
                    try {
                      const q = await quoteFromUsages({
                        repairCaseId: selected.id,
                      })
                      setMessage(`已建立維修報價 ${q.quoteNumber}`)
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : '轉報價失敗',
                      )
                    }
                  })()
                }}
              >
                耗用轉報價
              </button>
            </div>
          </form>

          <div className="stack">
            {history.usages.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無耗用
              </p>
            ) : (
              history.usages.map((u) => (
                <p key={u.id} style={{ margin: 0 }}>
                  {u.materialName} × {u.qty} · 成本 NT$
                  {u.totalCost.toLocaleString()}
                  <br />
                  <span className="muted">
                    {formatTaipei(u.postedAt, 'MM/dd HH:mm')} ·{' '}
                    {u.clientOperationId}
                  </span>
                </p>
              ))
            )}
            {history.usages.length > 0 ? (
              <Link to="/quotes" className="btn btn-ghost">
                前往報價列表
              </Link>
            ) : null}
          </div>

          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                try {
                  await createWarranty({
                    title: warTitle,
                    repairCaseId: selected.id,
                    endsOn: warEnds || null,
                    exclusionNotes: warExclusion || null,
                  })
                  setWarTitle('')
                  setWarEnds('')
                  setWarExclusion('')
                  setMessage('已建立保固主檔（期間內不自動免費）')
                } catch (err) {
                  setError(err instanceof Error ? err.message : '建立保固失敗')
                }
              })()
            }}
          >
            <strong>保固主檔（WAR-001）</strong>
            <div className="field">
              <label>標題</label>
              <input
                value={warTitle}
                onChange={(e) => setWarTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>到期日</label>
                <input
                  type="date"
                  value={warEnds}
                  onChange={(e) => setWarEnds(e.target.value)}
                />
              </div>
              <div className="field">
                <label>排除項目</label>
                <input
                  value={warExclusion}
                  onChange={(e) => setWarExclusion(e.target.value)}
                  placeholder="例如：人為損壞"
                />
              </div>
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              建立保固
            </button>
          </form>

          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                try {
                  await assessWarranty({
                    repairCaseId: selected.id,
                    warrantyId: assessWarId || null,
                    classification: assessClass,
                    rationale: assessReason,
                  })
                  setAssessReason('')
                  setMessage('已登錄保固判定（人工判定，非自動免費）')
                  await history.refetch()
                } catch (err) {
                  setError(err instanceof Error ? err.message : '判定失敗')
                }
              })()
            }}
          >
            <strong>保固判定</strong>
            <p className="muted" style={{ margin: 0 }}>
              保固期內排除項目不得自動免費；免費仍可另記成本。
            </p>
            <div className="field">
              <label>關聯保固（選填）</label>
              <select
                value={assessWarId}
                onChange={(e) => setAssessWarId(e.target.value)}
              >
                <option value="">不指定</option>
                {warranties.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                    {w.endsOn ? ` · 至 ${w.endsOn}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>判定</label>
                <select
                  value={assessClass}
                  onChange={(e) =>
                    setAssessClass(
                      e.target.value as WarrantyAssessmentClassification,
                    )
                  }
                >
                  {(
                    Object.keys(
                      WARRANTY_ASSESSMENT_LABELS,
                    ) as WarrantyAssessmentClassification[]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {WARRANTY_ASSESSMENT_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>理由（必填）</label>
                <input
                  value={assessReason}
                  onChange={(e) => setAssessReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <button className="btn btn-ghost" type="submit" disabled={saving}>
              登錄判定
            </button>
          </form>

          <div className="stack">
            {history.assessments.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無保固判定
              </p>
            ) : (
              history.assessments.map((a) => (
                <p key={a.id} style={{ margin: 0 }}>
                  {WARRANTY_ASSESSMENT_LABELS[a.classification]} · {a.rationale}
                  <br />
                  <span className="muted">
                    {a.assessedByName} ·{' '}
                    {formatTaipei(a.assessedAt, 'MM/dd HH:mm')}
                  </span>
                </p>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
