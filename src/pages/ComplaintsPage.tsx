import { useState, type FormEvent } from 'react'
import { COMPLAINT_STATUS_LABELS } from '@/domain/complaints'
import type { ComplaintStatus } from '@/domain/types'
import { useComplaints } from '@/hooks/useComplaints'
import { useRepairs } from '@/hooks/useRepairs'
import { useUser } from '@/hooks/useUser'

export function ComplaintsPage() {
  const { user } = useUser()
  const { repairs } = useRepairs()
  const {
    complaints,
    isLoading,
    createComplaint,
    setStatus,
    linkRelated,
    saving,
  } = useComplaints()

  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [repairCaseId, setRepairCaseId] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [linkNote, setLinkNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createComplaint({
        subject,
        detail: detail || null,
        repairCaseId: repairCaseId || null,
      })
      setSubject('')
      setDetail('')
      setRepairCaseId('')
      setShowForm(false)
      setMessage('已建立客訴（可不關聯工程）')
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    }
  }

  async function onLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await linkRelated({
        fromRepairCaseId: fromId,
        toRepairCaseId: toId,
        note: linkNote || null,
      })
      setLinkNote('')
      setMessage('已關聯重複維修（不合併／不刪除原案件）')
    } catch (err) {
      setError(err instanceof Error ? err.message : '關聯失敗')
    }
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>客訴（COM-001）</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              可不關聯工程建立；重複維修只關聯不合併。
              {user ? `（${user.role}）` : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '取消' : '新增客訴'}
          </button>
        </div>

        {showForm ? (
          <form className="stack" onSubmit={(e) => void onCreate(e)}>
            <div className="field">
              <label>主旨（必填）</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>說明（選填）</label>
              <input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>關聯維修（選填）</label>
              <select
                value={repairCaseId}
                onChange={(e) => setRepairCaseId(e.target.value)}
              >
                <option value="">不指定</option>
                {repairs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.problemDescription}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-steel" type="submit" disabled={saving}>
              建立客訴
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
        {isLoading ? <div className="empty">載入客訴…</div> : null}
        {!isLoading && complaints.length === 0 ? (
          <div className="empty">尚無客訴</div>
        ) : null}
        {complaints.map((c) => (
          <div key={c.id} className="panel stack">
            <div className="row between">
              <strong>{c.subject}</strong>
              <select
                value={c.status}
                onChange={(e) => {
                  void setStatus({
                    complaintId: c.id,
                    status: e.target.value as ComplaintStatus,
                  })
                }}
                disabled={saving}
              >
                {(Object.keys(COMPLAINT_STATUS_LABELS) as ComplaintStatus[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {COMPLAINT_STATUS_LABELS[s]}
                    </option>
                  ),
                )}
              </select>
            </div>
            {c.detail ? (
              <p className="muted" style={{ margin: 0 }}>
                {c.detail}
              </p>
            ) : null}
            <p className="muted" style={{ margin: 0 }}>
              {c.repairCaseId ? '已關聯維修' : '未關聯工程／維修'}
            </p>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <strong>重複維修關聯</strong>
        <p className="muted" style={{ margin: 0 }}>
          只建立關聯紀錄，不合併、不刪除原始案件。
        </p>
        <form className="stack" onSubmit={(e) => void onLink(e)}>
          <div className="grid-2">
            <div className="field">
              <label>案件 A</label>
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                required
              >
                <option value="">—</option>
                {repairs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.problemDescription}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>案件 B</label>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                required
              >
                <option value="">—</option>
                {repairs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.problemDescription}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>備註</label>
            <input
              value={linkNote}
              onChange={(e) => setLinkNote(e.target.value)}
            />
          </div>
          <button className="btn btn-ghost" type="submit" disabled={saving}>
            建立關聯
          </button>
        </form>
      </section>
    </div>
  )
}
