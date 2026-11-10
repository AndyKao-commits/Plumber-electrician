import { Link, useParams } from 'react-router-dom'
import { useSite } from '@/hooks/useSites'
import { useAttendance } from '@/hooks/useAttendance'
import { useUser } from '@/hooks/useUser'

export function SiteDetailPage() {
  const { siteId } = useParams()
  const { data: site, isLoading, isError, error } = useSite(siteId)
  const { user } = useUser()
  const { openShift, assignSite, isAssigningSite } = useAttendance(user?.id)

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
          連結可能含無效 ID（例如示範資料 site-a），請從工地列表重新進入。
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
      </section>

      <section className="panel stack">
        <strong>即將串接</strong>
        <p className="muted" style={{ margin: 0 }}>
          施工照片、材料採購、發票、成本與保固提醒會集中在此工地頁。臨時維修之後也可轉為正式工程。
        </p>
      </section>
    </div>
  )
}
