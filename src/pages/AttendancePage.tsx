import { formatDistanceStrict } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { FEATURE_FLAGS } from '@/domain/rules'
import { useAttendance } from '@/hooks/useAttendance'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function AttendancePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const {
    openShift,
    history,
    clockIn,
    clockOut,
    assignSite,
    isClockingIn,
    isClockingOut,
    isAssigningSite,
  } = useAttendance(user?.id)

  const siteName = (id?: string | null) =>
    sites.find((s) => s.id === id)?.name ?? (id ? '未知工地' : '尚未補登工地')

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>出勤打卡</strong>
        <p className="muted" style={{ margin: 0 }}>
          {FEATURE_FLAGS.autoDeductBreak
            ? '系統會自動扣除休息時間。'
            : '不自動扣除休息時間；工時依實際上下班計算。'}
        </p>

        {openShift ? (
          <>
            <div className="site-link">
              <div className="row between">
                <span className="badge ok">上班中</span>
                <span className="muted">
                  已打卡 {formatDistanceStrict(new Date(openShift.clockInAt), new Date(), { locale: zhTW })}
                </span>
              </div>
              <h3 style={{ marginTop: 10 }}>{siteName(openShift.siteId)}</h3>
              <p>
                上班時間 {formatTaipei(openShift.clockInAt, 'yyyy/MM/dd HH:mm')}
                {openShift.latitude != null
                  ? ` · GPS ${openShift.latitude.toFixed(4)}, ${openShift.longitude?.toFixed(4)}`
                  : ' · 無 GPS'}
              </p>
            </div>

            <div className="field">
              <label htmlFor="assign-site">補登／切換工地</label>
              <select
                id="assign-site"
                disabled={isAssigningSite}
                defaultValue={openShift.siteId ?? ''}
                onChange={(e) => {
                  const siteId = e.target.value
                  if (!siteId) return
                  const site = sites.find((s) => s.id === siteId)
                  void assignSite({
                    siteId,
                    jobType: site?.kind === 'repair' ? 'repair' : 'project',
                  })
                }}
              >
                <option value="">選擇工地</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-steel btn-block"
              disabled={isClockingOut}
              onClick={() => void clockOut()}
            >
              {isClockingOut ? '下班中…' : '下班打卡'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="clock-btn in"
            disabled={isClockingIn}
            onClick={() => void clockIn()}
          >
            {isClockingIn ? '打卡中…' : '一鍵上班'}
          </button>
        )}
      </section>

      <section className="panel stack">
        <strong>最近出勤</strong>
        {history.length === 0 ? (
          <div className="empty">尚無出勤紀錄</div>
        ) : (
          history.map((record) => (
            <div key={record.id} className="site-link">
              <div className="row between">
                <span className="badge steel">
                  {record.status === 'clocked_in' ? '進行中' : '已下班'}
                </span>
                <span className="muted">{siteName(record.siteId)}</span>
              </div>
              <p style={{ marginTop: 8 }}>
                {formatTaipei(record.clockInAt, 'MM/dd HH:mm')}
                {record.clockOutAt
                  ? ` → ${formatTaipei(record.clockOutAt, 'HH:mm')}`
                  : ' → 尚未下班'}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
