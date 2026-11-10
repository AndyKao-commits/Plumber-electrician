import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useAttendance } from '@/hooks/useAttendance'
import { usePhotos } from '@/hooks/usePhotos'
import { useReports } from '@/hooks/useReports'
import { useSite } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { useQuery } from '@tanstack/react-query'
import { supabaseRepos } from '@/lib/supabaseRepos'

export function SiteDetailPage() {
  const { siteId } = useParams()
  const { data: site, isLoading, isError, error } = useSite(siteId)
  const { user } = useUser()
  const { openShift, assignSite, isAssigningSite } = useAttendance(user?.id)
  const formal = isFormalMode()
  const { photos } = usePhotos()
  const { reports } = useReports(siteId)

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
    </div>
  )
}
