import { Link, useParams } from 'react-router-dom'
import { useMemo, useState, type FormEvent } from 'react'
import type { DefectSeverity } from '@/domain/types'
import { useAttendance } from '@/hooks/useAttendance'
import { useDailyLogs } from '@/hooks/useDailyLogs'
import { useDefects } from '@/hooks/useDefects'
import { usePhotos } from '@/hooks/usePhotos'
import { useReports } from '@/hooks/useReports'
import { useSite, useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { useQuery } from '@tanstack/react-query'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { taipeiDateString } from '@/lib/time'

export function SiteDetailPage() {
  const { siteId } = useParams()
  const { data: site, isLoading, isError, error } = useSite(siteId)
  const { updateWarranty, isUpdatingWarranty } = useSites()
  const { user } = useUser()
  const { openShift, assignSite, isAssigningSite } = useAttendance(user?.id)
  const formal = isFormalMode()
  const { photos } = usePhotos()
  const { reports } = useReports(siteId)
  const {
    logs,
    ensureDraft,
    isEnsuring,
    ensureError,
    saveBody,
    isSaving,
    publish,
    isPublishing,
    publishError,
  } = useDailyLogs(siteId)
  const {
    defects,
    createDefect,
    isCreating: isCreatingDefect,
    createError: defectCreateError,
    advanceDefect,
    isAdvancing,
  } = useDefects(siteId)
  const [defectTitle, setDefectTitle] = useState('')
  const [defectDetail, setDefectDetail] = useState('')
  const [defectSeverity, setDefectSeverity] = useState<DefectSeverity>('normal')
  const [warrantyDraft, setWarrantyDraft] = useState('')
  const [logDrafts, setLogDrafts] = useState<Record<string, string>>({})
  const todayLog = useMemo(
    () => logs.find((l) => l.logDate === taipeiDateString()),
    [logs],
  )

  const purchasesQuery = useQuery({
    queryKey: ['purchases', 'site', siteId],
    enabled: formal && Boolean(user && siteId),
    queryFn: async () => {
      if (!user) return []
      const all = await supabaseRepos.listPurchases(user)
      return all.filter((p) => p.siteId === siteId).slice(0, 8)
    },
  })

  const quotesQuery = useQuery({
    queryKey: ['quotes', 'site', siteId],
    enabled: formal && Boolean(siteId),
    queryFn: async () => {
      const all = await supabaseRepos.listQuotations()
      return all.filter((q) => q.projectId === siteId).slice(0, 8)
    },
  })

  const sitePhotos = useMemo(
    () =>
      photos
        .filter((p) => p.siteId === siteId && p.status === 'linked')
        .slice(0, 8),
    [photos, siteId],
  )

  if (isLoading) return <div className="empty">載入工地…</div>
  if (isError) {
    return (
      <div className="panel stack">
        <strong>無法載入工地</strong>
        <p style={{ color: 'var(--danger)', margin: 0 }}>
          {(error as Error)?.message || '請回列表重試'}
        </p>
        <Link to="/sites">回工地列表</Link>
      </div>
    )
  }
  if (!site) {
    return (
      <div className="panel stack">
        <strong>找不到工地</strong>
        <p className="muted" style={{ margin: 0 }}>
          連結可能含無效 ID，請從工地列表重新進入。
        </p>
        <Link to="/sites">回工地列表</Link>
      </div>
    )
  }

  const canAssign =
    Boolean(openShift) && openShift?.status === 'clocked_in' && openShift.siteId !== site.id

  return (
    <div className="stack fade-up">
      <section className="panel hero-panel stack">
        <Link to="/sites" className="muted">
          ← 工地列表
        </Link>
        <div className="badge">{site.kind === 'formal' ? '正式工程' : '臨時維修'}</div>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{site.name}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {[site.customerName, site.address].filter(Boolean).join(' · ') ||
            '尚未填寫客戶或地址'}
        </p>
        {formal ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              保固到期：{site.warrantyUntil || '未設定'}（到期前 30 天會產生站內待辦）
            </p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={warrantyDraft || site.warrantyUntil || ''}
                onChange={(e) => setWarrantyDraft(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isUpdatingWarranty}
                onClick={() =>
                  void updateWarranty({
                    siteId: site.id,
                    warrantyUntil: (warrantyDraft || site.warrantyUntil || null) as string | null,
                  })
                }
              >
                {isUpdatingWarranty ? '儲存中…' : '儲存保固日'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>今日操作</strong>
        {canAssign ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={isAssigningSite}
            onClick={() =>
              void assignSite({
                siteId: site.id,
                jobType: site.kind === 'repair' ? 'repair' : 'project',
              })
            }
          >
            {isAssigningSite ? '切換中…' : '切換到此工地（不需重新打卡）'}
          </button>
        ) : openShift?.siteId === site.id ? (
          <p className="muted" style={{ margin: 0 }}>
            你目前已在此工地上班中。
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            先到首頁一鍵上班，再回來補登或切換工地。
          </p>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-steel" to={`/reports?siteId=${site.id}`}>
            施工回報
          </Link>
          <Link className="btn btn-ghost" to={`/photos`}>
            施工照片
          </Link>
          <Link className="btn btn-ghost" to={`/purchases`}>
            材料採購
          </Link>
          <Link className="btn btn-ghost" to={`/quotes`}>
            報價
          </Link>
        </div>
      </section>

      {formal ? (
        <section className="panel stack">
          <div className="row between">
            <strong>施工日誌</strong>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              每日一則 · 彙整後發布
            </span>
          </div>
          <button
            type="button"
            className="btn btn-steel"
            disabled={isEnsuring}
            onClick={() => void ensureDraft()}
          >
            {isEnsuring
              ? '彙整中…'
              : todayLog
                ? '重新彙整今日草稿'
                : '彙整今日日誌草稿'}
          </button>
          {ensureError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>{ensureError.message}</p>
          ) : null}
          {logs.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              尚無日誌。可先有出勤／回報／照片／缺失後再彙整。
            </p>
          ) : (
            logs.slice(0, 7).map((log) => (
              <div key={log.id} className="site-link stack">
                <div className="row between">
                  <strong style={{ margin: 0 }}>{log.logDate}</strong>
                  <span className="badge">
                    {log.status === 'published'
                      ? `已發布 v${log.currentVersion}`
                      : '草稿'}
                  </span>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  回報 {log.summary.reportCount} · 照片 {log.summary.photoCount} · 缺失{' '}
                  {log.summary.defectCount} · 出勤 {log.summary.attendanceCount}
                </p>
                {log.status === 'draft' ? (
                  <>
                    <textarea
                      rows={6}
                      value={logDrafts[log.id] ?? log.body}
                      onChange={(e) =>
                        setLogDrafts((prev) => ({ ...prev, [log.id]: e.target.value }))
                      }
                    />
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={isSaving}
                        onClick={() =>
                          void saveBody({
                            logId: log.id,
                            body: logDrafts[log.id] ?? log.body,
                          })
                        }
                      >
                        {isSaving ? '儲存中…' : '儲存草稿'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-steel"
                        disabled={isPublishing}
                        onClick={() => void publish(log.id)}
                      >
                        {isPublishing ? '發布中…' : '確認發布'}
                      </button>
                    </div>
                    {publishError ? (
                      <p style={{ color: 'var(--danger)', margin: 0 }}>
                        {publishError.message}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: '0.9rem',
                    }}
                  >
                    {log.body}
                  </pre>
                )}
              </div>
            ))
          )}
        </section>
      ) : null}

      <section className="panel stack">
        <div className="row between">
          <strong>施工回報</strong>
          <Link to={`/reports?siteId=${site.id}`}>全部</Link>
        </div>
        {reports.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>尚無回報</p>
        ) : (
          reports.slice(0, 5).map((report) => (
            <div key={report.id} className="stack" style={{ gap: 4 }}>
              <p style={{ margin: 0 }}>
                {report.body || '（僅照片）'} · {report.authorName || '未知'}
              </p>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {new Date(report.createdAt).toLocaleString('zh-TW', {
                  timeZone: 'Asia/Taipei',
                })}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="panel stack">
        <div className="row between">
          <strong>施工照片</strong>
          <Link to="/photos">管理</Link>
        </div>
        {sitePhotos.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>尚無已歸檔照片</p>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {sitePhotos.map((photo) =>
              photo.previewUrl ? (
                <img
                  key={photo.id}
                  src={photo.previewUrl}
                  alt="工地照片"
                  style={{
                    width: 96,
                    height: 96,
                    objectFit: 'cover',
                    borderRadius: 8,
                  }}
                />
              ) : null,
            )}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="row between">
          <strong>採購</strong>
          <Link to="/purchases">前往</Link>
        </div>
        {(purchasesQuery.data ?? []).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>尚無採購紀錄</p>
        ) : (
          (purchasesQuery.data ?? []).map((p) => (
            <p key={p.id} style={{ margin: 0 }}>
              {p.title || '採購'} · {p.status} · NT${Number(p.finalPayable ?? 0).toLocaleString()}
            </p>
          ))
        )}
      </section>

      <section className="panel stack">
        <div className="row between">
          <strong>報價</strong>
          <Link to="/quotes">前往</Link>
        </div>
        {(quotesQuery.data ?? []).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>尚無報價</p>
        ) : (
          (quotesQuery.data ?? []).map((q) => (
            <p key={q.id} style={{ margin: 0 }}>
              {q.title} · {q.status}
            </p>
          ))
        )}
      </section>

      {formal ? (
        <section className="panel stack">
          <strong>缺失／複驗</strong>
          <p className="muted" style={{ margin: 0 }}>
            流程：待改善 → 已改善 → 複驗 → 結案。安全缺失須複驗後才能結案。
          </p>
          <form
            className="stack"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              void createDefect({
                title: defectTitle,
                detail: defectDetail,
                severity: defectSeverity,
              }).then(() => {
                setDefectTitle('')
                setDefectDetail('')
                setDefectSeverity('normal')
              })
            }}
          >
            <div className="field">
              <label htmlFor="defect-title">缺失標題</label>
              <input
                id="defect-title"
                value={defectTitle}
                onChange={(e) => setDefectTitle(e.target.value)}
                required
                placeholder="例如：浴室地漏堵塞"
              />
            </div>
            <div className="field">
              <label htmlFor="defect-detail">說明</label>
              <textarea
                id="defect-detail"
                rows={2}
                value={defectDetail}
                onChange={(e) => setDefectDetail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="defect-severity">嚴重度</label>
              <select
                id="defect-severity"
                value={defectSeverity}
                onChange={(e) =>
                  setDefectSeverity(e.target.value as DefectSeverity)
                }
              >
                <option value="normal">一般</option>
                <option value="safety">安全（P0）</option>
              </select>
            </div>
            {defectCreateError ? (
              <p style={{ color: 'var(--danger)', margin: 0 }}>
                {defectCreateError.message}
              </p>
            ) : null}
            <button
              className="btn btn-steel"
              type="submit"
              disabled={isCreatingDefect || !defectTitle.trim()}
            >
              {isCreatingDefect ? '新增中…' : '新增缺失'}
            </button>
          </form>

          {defects.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>尚無缺失</p>
          ) : (
            defects.map((d) => (
              <div key={d.id} className="site-link stack">
                <div className="row between">
                  <strong style={{ margin: 0 }}>{d.title}</strong>
                  <span className="badge">
                    {d.severity === 'safety' ? '安全' : '一般'} · {d.status}
                  </span>
                </div>
                {d.detail ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {d.detail}
                  </p>
                ) : null}
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  {d.reporterName || '未知'} ·{' '}
                  {new Date(d.createdAt).toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                  })}
                </p>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {d.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={isAdvancing}
                      onClick={() =>
                        void advanceDefect({
                          defectId: d.id,
                          action: 'fix',
                          note: '已改善',
                        })
                      }
                    >
                      標記已改善
                    </button>
                  ) : null}
                  {d.status === 'fixed' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={isAdvancing}
                      onClick={() =>
                        void advanceDefect({
                          defectId: d.id,
                          action: 'reinspect',
                          note: '複驗通過',
                        })
                      }
                    >
                      複驗通過
                    </button>
                  ) : null}
                  {d.status === 'fixed' && d.severity === 'normal' ? (
                    <button
                      type="button"
                      className="btn btn-steel"
                      disabled={isAdvancing}
                      onClick={() =>
                        void advanceDefect({ defectId: d.id, action: 'close' })
                      }
                    >
                      結案
                    </button>
                  ) : null}
                  {d.status === 'reinspected' ? (
                    <button
                      type="button"
                      className="btn btn-steel"
                      disabled={isAdvancing}
                      onClick={() =>
                        void advanceDefect({ defectId: d.id, action: 'close' })
                      }
                    >
                      結案
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  )
}
