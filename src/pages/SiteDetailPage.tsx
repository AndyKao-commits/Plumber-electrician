import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SITE_STATUS_LABELS } from '@/domain/siteStatus'
import type { DefectSeverity } from '@/domain/types'
import { useAttendance } from '@/hooks/useAttendance'
import { useDailyLogs } from '@/hooks/useDailyLogs'
import { useDefects } from '@/hooks/useDefects'
import { usePhotos } from '@/hooks/usePhotos'
import { useReports } from '@/hooks/useReports'
import { useSite, useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  downloadBlob,
  generateSitePhotosPdfBlob,
  sitePhotosPdfFilename,
} from '@/lib/sitePhotoExport'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { taipeiDateString } from '@/lib/time'

export function SiteDetailPage() {
  const { siteId } = useParams()
  const { data: site, isLoading, isError, error } = useSite(siteId)
  const {
    updateWarranty,
    isUpdatingWarranty,
    updateSiteStatus,
    isUpdatingStatus,
  } = useSites()
  const { user, directory } = useUser()
  const queryClient = useQueryClient()
  const { openShift, assignSite, isAssigningSite } = useAttendance(user?.id)
  const formal = isFormalMode()
  const { photos } = usePhotos(siteId)
  const isBoss = user?.role === 'boss'
  const [memberDraft, setMemberDraft] = useState<string[]>([])
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

  const quotesQuery = useQuery({
    queryKey: ['quotes', 'site', siteId],
    enabled: formal && Boolean(siteId),
    queryFn: async () => {
      const all = await supabaseRepos.listQuotations()
      return all.filter((q) => q.projectId === siteId).slice(0, 8)
    },
  })

  const allSitePhotos = useMemo(
    () => photos.filter((p) => p.siteId === siteId && p.status === 'linked'),
    [photos, siteId],
  )
  const sitePhotos = useMemo(() => allSitePhotos.slice(0, 8), [allSitePhotos])
  const [exportingPdf, setExportingPdf] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: ['site-members', siteId],
    enabled: Boolean(siteId && user),
    queryFn: async () => {
      if (!siteId) return []
      return formal
        ? supabaseRepos.listSiteMemberIds(siteId)
        : localDb.listSiteMembers(siteId)
    },
  })

  const orgUsersQuery = useQuery({
    queryKey: ['org-users-for-sites'],
    enabled: Boolean(user && isBoss),
    queryFn: async () => {
      if (!user) return []
      if (formal) return supabaseRepos.listOrgProfiles(user)
      return localDb.getUsers()
    },
  })

  useEffect(() => {
    setMemberDraft(membersQuery.data ?? [])
  }, [membersQuery.data])

  const saveMembers = useMutation({
    mutationFn: async () => {
      if (!user || !siteId) throw new Error('尚未登入')
      if (formal) await supabaseRepos.setSiteMembers(user, siteId, memberDraft)
      else localDb.setSiteMembers(user, siteId, memberDraft)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['site-members', siteId] })
      void queryClient.invalidateQueries({ queryKey: ['sites'] })
    },
  })

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
    site.status !== 'closed' &&
    Boolean(openShift) &&
    openShift?.status === 'clocked_in' &&
    openShift.siteId !== site.id

  return (
    <div className="stack fade-up">
      <section className="panel hero-panel stack">
        <Link to="/sites" className="muted">
          ← 工地列表
        </Link>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="badge">
            {site.kind === 'formal' ? '正式工程' : '臨時維修'}
          </span>
          <span className={`badge ${site.status === 'closed' ? '' : 'ok'}`}>
            {SITE_STATUS_LABELS[site.status]}
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{site.name}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {[site.customerName, site.address].filter(Boolean).join(' · ') ||
            '尚未填寫客戶或地址'}
        </p>
        {isBoss ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {site.status !== 'closed' ? (
              <button
                type="button"
                className="btn btn-steel"
                disabled={isUpdatingStatus}
                onClick={() => {
                  if (
                    !window.confirm(
                      '確定結案？結案後不會再出現在 LINE 選工地，網站可於「已結案」查看。',
                    )
                  ) {
                    return
                  }
                  void updateSiteStatus({
                    siteId: site.id,
                    status: 'closed',
                  }).catch((e) => window.alert((e as Error).message))
                }}
              >
                {isUpdatingStatus ? '更新中…' : '結案'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-steel"
                disabled={isUpdatingStatus}
                onClick={() => {
                  void updateSiteStatus({
                    siteId: site.id,
                    status: 'active',
                  }).catch((e) => window.alert((e as Error).message))
                }}
              >
                {isUpdatingStatus ? '更新中…' : '重開工程'}
              </button>
            )}
            {site.status !== 'warranty' ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isUpdatingStatus}
                onClick={() => {
                  void updateSiteStatus({
                    siteId: site.id,
                    status: 'warranty',
                  }).catch((e) => window.alert((e as Error).message))
                }}
              >
                標為保固中
              </button>
            ) : null}
          </div>
        ) : null}
        {formal ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              保固到期：{site.warrantyUntil || '未設定'}
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
          <Link className="btn btn-ghost" to={`/photos?siteId=${site.id}`}>
            施工照片
          </Link>
          <Link className="btn btn-ghost" to={`/expenses`}>
            支出／收款
          </Link>
        </div>
      </section>

      {isBoss && siteId ? (
        <section className="panel stack">
          <strong>有權限工地成員</strong>
          {(orgUsersQuery.data ?? directory)
            .filter((u) => u.role === 'employee')
            .map((u) => {
              const checked = memberDraft.includes(u.id)
              return (
                <label key={u.id} className="row" style={{ gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setMemberDraft((prev) =>
                        e.target.checked
                          ? [...prev, u.id]
                          : prev.filter((id) => id !== u.id),
                      )
                    }}
                  />
                  <span>
                    {u.name}
                    {u.jobTitle ? ` · ${u.jobTitle}` : ''}
                  </span>
                </label>
              )
            })}
          <button
            type="button"
            className="btn btn-steel"
            disabled={saveMembers.isPending}
            onClick={() => void saveMembers.mutateAsync()}
          >
            {saveMembers.isPending ? '儲存中…' : '儲存工地權限'}
          </button>
          {saveMembers.error ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {toUserMessage(saveMembers.error)}
            </p>
          ) : null}
        </section>
      ) : null}

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
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <strong>施工照片（{allSitePhotos.length}）</strong>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-ghost" to={`/photos?siteId=${siteId}`}>
              管理
            </Link>
            <button
              type="button"
              className="btn btn-steel"
              disabled={exportingPdf || allSitePhotos.length === 0}
              onClick={() => {
                void (async () => {
                  if (!site) return
                  setExportingPdf(true)
                  try {
                    const withUrl = allSitePhotos.filter((p) => p.previewUrl)
                    const blob = await generateSitePhotosPdfBlob({
                      siteName: site.name,
                      photos: withUrl.map((p) => ({
                        previewUrl: p.previewUrl!,
                        photoType: p.photoType,
                        createdAt: p.createdAt,
                        uploaderName: p.uploaderName,
                      })),
                    })
                    downloadBlob(blob, sitePhotosPdfFilename(site.name))
                  } catch (e) {
                    window.alert((e as Error).message)
                  } finally {
                    setExportingPdf(false)
                  }
                })()
              }}
            >
              {exportingPdf ? '匯出中…' : '匯出照片 PDF'}
            </button>
          </div>
        </div>
        {sitePhotos.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>尚無已歸檔照片</p>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {sitePhotos.map((photo) =>
              photo.previewUrl ? (
                <button
                  key={photo.id}
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: 0, border: 'none', background: 'transparent' }}
                  onClick={() => setPreviewUrl(photo.previewUrl!)}
                >
                  <img
                    src={photo.previewUrl}
                    alt="工地照片"
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 8,
                      display: 'block',
                    }}
                  />
                </button>
              ) : null,
            )}
          </div>
        )}
      </section>

      {previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <img
            src={previewUrl}
            alt="預覽"
            style={{
              maxWidth: '100%',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />
        </div>
      ) : null}

      {(quotesQuery.data ?? []).length > 0 ? (
        <section className="panel stack">
          <div className="row between">
            <strong>相關報價</strong>
            <Link to="/quotes">全部</Link>
          </div>
          {(quotesQuery.data ?? []).slice(0, 3).map((q) => (
            <Link key={q.id} className="site-link" to={`/quotes/${q.id}`}>
              <h3>{q.title}</h3>
              <p>{q.workflowStatus || q.status}</p>
            </Link>
          ))}
        </section>
      ) : null}

      {formal ? (
        <section className="panel stack">
          <strong>缺失／複驗</strong>
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
