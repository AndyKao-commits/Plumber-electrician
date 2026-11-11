import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceStrict } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  buildAttendanceTimeline,
  formatWorkDuration,
  summarizeAttendanceDay,
} from '@/domain/attendanceTimeline'
import { selectOpenSites } from '@/domain/siteStatus'
import { useAttendance } from '@/hooks/useAttendance'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { formatTaipei, taipeiDateString } from '@/lib/time'

/** datetime-local value → ISO, treating wall clock as Asia/Taipei. */
function taipeiLocalToIso(local: string): string {
  if (!local) throw new Error('請填寫時間')
  const withSeconds = local.length === 16 ? `${local}:00` : local
  const d = new Date(`${withSeconds}+08:00`)
  if (Number.isNaN(d.getTime())) throw new Error('時間格式無效')
  return d.toISOString()
}

function isoToTaipeiLocal(iso?: string | null): string {
  if (!iso) return ''
  return formatTaipei(iso, "yyyy-MM-dd'T'HH:mm")
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待核准',
  approved: '已核准',
  rejected: '已駁回',
}

export function AttendancePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const openSites = useMemo(() => selectOpenSites(sites), [sites])
  const {
    openShift,
    history,
    corrections,
    pendingCorrections,
    canApproveCorrections,
    clockIn,
    clockOut,
    assignSite,
    applyCorrection,
    approveCorrection,
    rejectCorrection,
    isClockingIn,
    isClockingOut,
    isAssigningSite,
    isApplyingCorrection,
    applyCorrectionError,
    isApprovingCorrection,
    approveCorrectionError,
    isRejectingCorrection,
    rejectCorrectionError,
  } = useAttendance(user?.id)

  const [linkAttendanceId, setLinkAttendanceId] = useState('')
  const [proposedIn, setProposedIn] = useState('')
  const [proposedOut, setProposedOut] = useState('')
  const [proposedSiteId, setProposedSiteId] = useState('')
  const [reason, setReason] = useState('')
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [timelineId, setTimelineId] = useState<string | null>(null)

  const siteName = (id?: string | null) =>
    sites.find((s) => s.id === id)?.name ?? (id ? '未知工地' : '尚未補登工地')

  const timelineRecord = history.find((h) => h.id === timelineId) ?? null
  const timelineDay = timelineRecord
    ? taipeiDateString(timelineRecord.clockInAt)
    : null

  const timelineQuery = useQuery({
    queryKey: ['attendance-timeline', user?.id, timelineId, timelineDay],
    enabled: Boolean(user?.id && timelineRecord && timelineDay),
    queryFn: async () => {
      if (!user || !timelineRecord || !timelineDay) return []
      if (isFormalMode()) {
        return supabaseRepos.listLocationCheckins({
          userId: user.id,
          day: timelineDay,
        })
      }
      return localDb.listLocationCheckinsForDay(user.id, timelineDay)
    },
  })

  function fillFromRecord(attendanceId: string) {
    setLinkAttendanceId(attendanceId)
    const record = history.find((h) => h.id === attendanceId)
    if (!record) return
    setProposedIn(isoToTaipeiLocal(record.clockInAt))
    setProposedOut(isoToTaipeiLocal(record.clockOutAt))
    setProposedSiteId(record.siteId ?? '')
    window.requestAnimationFrame(() => {
      document
        .getElementById('correction-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function onSubmitCorrection(event: FormEvent) {
    event.preventDefault()
    await applyCorrection({
      attendanceId: linkAttendanceId || null,
      proposedClockInAt: taipeiLocalToIso(proposedIn),
      proposedClockOutAt: proposedOut ? taipeiLocalToIso(proposedOut) : null,
      proposedSiteId: proposedSiteId || null,
      reason,
    })
    setReason('')
    setLinkAttendanceId('')
    setProposedIn('')
    setProposedOut('')
    setProposedSiteId('')
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>出勤打卡</strong>

        {openShift ? (
          <>
            <div className="site-link">
              <div className="row between">
                <span className="badge ok">上班中</span>
                <span className="muted">
                  已打卡{' '}
                  {formatDistanceStrict(new Date(openShift.clockInAt), new Date(), {
                    locale: zhTW,
                  })}
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
                {openSites.map((site) => (
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

      {canApproveCorrections && pendingCorrections.length > 0 ? (
        <section className="panel stack">
          <strong>待核准補打卡</strong>
          {pendingCorrections.map((c) => (
            <div key={c.id} className="site-link stack">
              <div className="row between">
                <span className="badge">pending</span>
                <span className="muted">
                  {formatTaipei(c.createdAt, 'MM/dd HH:mm')}
                </span>
              </div>
              <p style={{ margin: 0 }}>
                擬訂 {formatTaipei(c.proposedClockInAt, 'MM/dd HH:mm')}
                {c.proposedClockOutAt
                  ? ` → ${formatTaipei(c.proposedClockOutAt, 'HH:mm')}`
                  : ' → （未填下班）'}
                {c.proposedSiteId ? ` · ${siteName(c.proposedSiteId)}` : ''}
              </p>
              {c.originalClockInAt ? (
                <p className="muted" style={{ margin: 0 }}>
                  原始 {formatTaipei(c.originalClockInAt, 'MM/dd HH:mm')}
                  {c.originalClockOutAt
                    ? ` → ${formatTaipei(c.originalClockOutAt, 'HH:mm')}`
                    : ' → （無下班）'}
                </p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  無對應原始打卡（漏打補登）
                </p>
              )}
              <p style={{ margin: 0 }}>原因：{c.reason}</p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-steel"
                  disabled={isApprovingCorrection}
                  onClick={() => void approveCorrection(c.id)}
                >
                  核准並覆蓋出勤
                </button>
              </div>
              <div className="field">
                <label htmlFor={`reject-ac-${c.id}`}>駁回原因</label>
                <input
                  id={`reject-ac-${c.id}`}
                  value={rejectReasons[c.id] ?? ''}
                  onChange={(e) =>
                    setRejectReasons((prev) => ({
                      ...prev,
                      [c.id]: e.target.value,
                    }))
                  }
                  placeholder="必填"
                />
              </div>
              <button
                type="button"
                className="btn btn-block"
                disabled={isRejectingCorrection}
                onClick={() =>
                  void rejectCorrection({
                    correctionId: c.id,
                    reason: rejectReasons[c.id] ?? '',
                  })
                }
              >
                駁回
              </button>
            </div>
          ))}
          {approveCorrectionError ? (
            <p className="error">{(approveCorrectionError as Error).message}</p>
          ) : null}
          {rejectCorrectionError ? (
            <p className="error">{(rejectCorrectionError as Error).message}</p>
          ) : null}
        </section>
      ) : null}

      <section className="panel stack" id="correction-form">
        <strong>申請更正</strong>
        <form className="stack" onSubmit={(e) => void onSubmitCorrection(e)}>
          <div className="field">
            <label htmlFor="link-attendance">對應出勤（可選）</label>
            <select
              id="link-attendance"
              value={linkAttendanceId}
              onChange={(e) => fillFromRecord(e.target.value)}
            >
              <option value="">漏打補登（無原始紀錄）</option>
              {history.map((record) => (
                <option key={record.id} value={record.id}>
                  {formatTaipei(record.clockInAt, 'MM/dd HH:mm')}
                  {record.clockOutAt
                    ? ` → ${formatTaipei(record.clockOutAt, 'HH:mm')}`
                    : ' → 進行中'}{' '}
                  · {siteName(record.siteId)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="proposed-in">擬訂上班（台北時間）</label>
            <input
              id="proposed-in"
              type="datetime-local"
              required
              value={proposedIn}
              onChange={(e) => setProposedIn(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="proposed-out">擬訂下班（可空）</label>
            <input
              id="proposed-out"
              type="datetime-local"
              value={proposedOut}
              onChange={(e) => setProposedOut(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="proposed-site">擬訂工地（可空）</label>
            <select
              id="proposed-site"
              value={proposedSiteId}
              onChange={(e) => setProposedSiteId(e.target.value)}
            >
              <option value="">不指定</option>
              {openSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="correction-reason">原因</label>
            <input
              id="correction-reason"
              required
              minLength={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：手機沒電漏打卡"
            />
          </div>
          <button
            type="submit"
            className="btn btn-steel btn-block"
            disabled={isApplyingCorrection}
          >
            {isApplyingCorrection ? '送出中…' : '送出更正申請'}
          </button>
          {applyCorrectionError ? (
            <p className="error">{(applyCorrectionError as Error).message}</p>
          ) : null}
        </form>
      </section>

      <section className="panel stack">
        <strong>我的補打卡紀錄</strong>
        {corrections.length === 0 ? (
          <div className="empty">尚無補打卡申請</div>
        ) : (
          corrections
            .filter((c) => !canApproveCorrections || c.userId === user?.id)
            .slice(0, 20)
            .map((c) => (
              <div key={c.id} className="site-link">
                <div className="row between">
                  <span
                    className={`badge ${c.status === 'approved' ? 'ok' : ''}`}
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                  <span className="muted">
                    {formatTaipei(c.createdAt, 'MM/dd HH:mm')}
                  </span>
                </div>
                <p style={{ marginTop: 8 }}>
                  擬訂 {formatTaipei(c.proposedClockInAt, 'MM/dd HH:mm')}
                  {c.proposedClockOutAt
                    ? ` → ${formatTaipei(c.proposedClockOutAt, 'HH:mm')}`
                    : ''}
                </p>
                {c.status === 'approved' && c.effectiveClockInAt ? (
                  <p className="muted" style={{ margin: 0 }}>
                    有效工時 {formatTaipei(c.effectiveClockInAt, 'MM/dd HH:mm')}
                    {c.effectiveClockOutAt
                      ? ` → ${formatTaipei(c.effectiveClockOutAt, 'HH:mm')}`
                      : ''}
                  </p>
                ) : null}
                {c.status === 'rejected' && c.reviewNote ? (
                  <p className="muted" style={{ margin: 0 }}>
                    駁回：{c.reviewNote}
                  </p>
                ) : null}
                <p className="muted" style={{ margin: 0 }}>
                  {c.reason}
                </p>
              </div>
            ))
        )}
      </section>

      <section className="panel stack">
        <strong>最近出勤</strong>
        <p className="muted" style={{ margin: 0 }}>
          點一天可看完整時間軸（上班／足跡／下班）。
        </p>
        {history.length === 0 ? (
          <div className="empty">尚無出勤紀錄</div>
        ) : (
          history.map((record) => {
            const open = timelineId === record.id
            const dayLabel = formatTaipei(record.clockInAt, 'yyyy/MM/dd EEEE')
            const checkins = open ? (timelineQuery.data ?? []) : []
            const events = open
              ? buildAttendanceTimeline({
                  attendance: {
                    ...record,
                    // enrich site name into note for place when assigned
                  },
                  checkins: checkins.map((c) => ({
                    ...c,
                    siteName:
                      c.siteName ||
                      (c.siteId ? siteName(c.siteId) : null),
                  })),
                }).map((ev) =>
                  ev.kind === 'clock_in' && record.siteId
                    ? {
                        ...ev,
                        placeLabel: siteName(record.siteId),
                      }
                    : ev.kind === 'clock_in'
                      ? { ...ev, placeLabel: '出發上工' }
                      : ev,
                )
              : []
            const summary = open
              ? summarizeAttendanceDay({
                  clockInAt: record.clockInAt,
                  clockOutAt: record.clockOutAt,
                  locationCount: checkins.length,
                })
              : null

            return (
              <div key={record.id} className="site-link stack">
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ textAlign: 'left', padding: 0 }}
                  onClick={() =>
                    setTimelineId((cur) => (cur === record.id ? null : record.id))
                  }
                >
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
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {open ? '收合時間軸' : '展開時間軸'}
                  </p>
                </button>

                {open ? (
                  <div className="stack" style={{ gap: 8 }}>
                    <strong style={{ margin: 0 }}>{dayLabel}</strong>
                    {summary ? (
                      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                        上班時間：{formatTaipei(record.clockInAt, 'HH:mm')}
                        {record.clockOutAt
                          ? `　下班時間：${formatTaipei(record.clockOutAt, 'HH:mm')}`
                          : ''}
                        <br />
                        工作時數：{formatWorkDuration(summary.workMs)}
                        <br />
                        地點紀錄：
                        {summary.locationCount > 0
                          ? `${summary.locationCount} 筆`
                          : '當天沒有其他地點紀錄'}
                      </p>
                    ) : null}
                    {timelineQuery.isLoading ? (
                      <p className="muted" style={{ margin: 0 }}>
                        載入足跡…
                      </p>
                    ) : (
                      events.map((ev) => (
                        <div key={ev.id}>
                          <p style={{ margin: 0 }}>
                            <strong>{formatTaipei(ev.at, 'HH:mm')}</strong>　
                            {ev.title}
                          </p>
                          {ev.placeLabel ? (
                            <p className="muted" style={{ margin: '2px 0 0' }}>
                              {ev.placeLabel}
                            </p>
                          ) : null}
                          {ev.address ? (
                            <p className="muted" style={{ margin: '2px 0 0' }}>
                              {ev.address}
                            </p>
                          ) : null}
                          {ev.note ? (
                            <p className="muted" style={{ margin: '2px 0 0' }}>
                              {ev.note}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => fillFromRecord(record.id)}
                    >
                      申請更正
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
