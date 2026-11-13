import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceStrict } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  buildMonthGrid,
  currentTaipeiYearMonth,
  groupAttendanceDays,
  shiftMonth,
} from '@/domain/attendanceCalendar'
import {
  buildAttendanceTimeline,
  formatWorkDuration,
  summarizeAttendanceDay,
  summarizeDayShifts,
} from '@/domain/attendanceTimeline'
import { selectOpenSites } from '@/domain/siteStatus'
import { useAttendance } from '@/hooks/useAttendance'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { formatTaipei, taipeiDateString } from '@/lib/time'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

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
  const [dayTimelineOpen, setDayTimelineOpen] = useState(false)
  const initialYm = currentTaipeiYearMonth()
  const [calYear, setCalYear] = useState(initialYm.year)
  const [calMonth, setCalMonth] = useState(initialYm.monthIndex)
  const [selectedDay, setSelectedDay] = useState<string | null>(
    () => taipeiDateString(),
  )

  const siteName = (id?: string | null) =>
    sites.find((s) => s.id === id)?.name ?? (id ? '未知工地' : null)

  const daysWithWork = useMemo(() => groupAttendanceDays(history), [history])
  const monthCells = useMemo(
    () => buildMonthGrid(calYear, calMonth),
    [calYear, calMonth],
  )
  const dayRecords = useMemo(() => {
    if (!selectedDay) return []
    return history
      .filter((r) => taipeiDateString(r.clockInAt) === selectedDay)
      .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt))
  }, [history, selectedDay])

  const daySummary = useMemo(
    () => (dayRecords.length ? summarizeDayShifts(dayRecords) : null),
    [dayRecords],
  )

  const ownPendingCorrections = useMemo(
    () =>
      corrections.filter(
        (c) => c.userId === user?.id && c.status === 'pending',
      ),
    [corrections, user?.id],
  )

  const timelineQuery = useQuery({
    queryKey: ['attendance-timeline', user?.id, selectedDay, dayTimelineOpen],
    enabled: Boolean(user?.id && selectedDay && dayTimelineOpen),
    queryFn: async () => {
      if (!user || !selectedDay) return []
      if (isFormalMode()) {
        return supabaseRepos.listLocationCheckins({
          userId: user.id,
          day: selectedDay,
        })
      }
      return localDb.listLocationCheckinsForDay(user.id, selectedDay)
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
            <div className="attendance-day-card is-open">
              <div className="row between" style={{ alignItems: 'center' }}>
                <span className="badge ok">上班中</span>
                <span className="muted">
                  已打卡{' '}
                  {formatDistanceStrict(new Date(openShift.clockInAt), new Date(), {
                    locale: zhTW,
                  })}
                </span>
              </div>
              <p className="attendance-day-time" style={{ marginTop: 10 }}>
                {formatTaipei(openShift.clockInAt, 'yyyy/MM/dd HH:mm')} 上班
                {openShift.latitude != null
                  ? ` · GPS ${openShift.latitude.toFixed(4)}, ${openShift.longitude?.toFixed(4)}`
                  : ''}
              </p>
              {openShift.siteId ? (
                <p className="attendance-day-site">{siteName(openShift.siteId)}</p>
              ) : (
                <p className="attendance-day-site is-missing">尚未指定工地</p>
              )}
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
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            申請人不可自行核准。請由其他老闆或具核准權的管理員處理。
          </p>
          {pendingCorrections.map((c) => (
            <div key={c.id} className="site-link stack">
              <div className="row between">
                <span className="badge">待核准</span>
                <span className="muted">
                  {formatTaipei(c.createdAt, 'MM/dd HH:mm')}
                </span>
              </div>
              <p style={{ margin: 0 }}>
                {c.userName ? `${c.userName} · ` : ''}
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
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          申請人不可自行核准。老闆的補打卡須由其他老闆，或具核准權的管理員處理。
        </p>
        {ownPendingCorrections.length > 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            目前有 {ownPendingCorrections.length} 筆待核准，已通知其他核准人。
          </p>
        ) : null}
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
          有出勤的日期會標點；點日期看當天摘要。
        </p>
        <div className="row between" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const next = shiftMonth(calYear, calMonth, -1)
              setCalYear(next.year)
              setCalMonth(next.monthIndex)
            }}
          >
            上個月
          </button>
          <strong style={{ margin: 0 }}>
            {calYear} 年 {calMonth + 1} 月
          </strong>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const next = shiftMonth(calYear, calMonth, 1)
              setCalYear(next.year)
              setCalMonth(next.monthIndex)
            }}
          >
            下個月
          </button>
        </div>
        <div className="attendance-cal">
          {WEEKDAYS.map((w) => (
            <div key={w} className="attendance-cal-head">
              {w}
            </div>
          ))}
          {monthCells.map((cell, idx) => {
            if (!cell.day) {
              return (
                <div key={`pad-${idx}`} className="attendance-cal-day muted" />
              )
            }
            const hasWork = daysWithWork.has(cell.day)
            const selected = selectedDay === cell.day
            return (
              <button
                key={cell.day}
                type="button"
                className={`attendance-cal-day${hasWork ? ' has-work' : ''}${selected ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedDay(cell.day)
                  setDayTimelineOpen(false)
                }}
              >
                <span className="cal-num">{Number(cell.day.slice(8))}</span>
                {hasWork ? <span className="cal-dot" aria-hidden /> : null}
              </button>
            )
          })}
        </div>

        {!selectedDay ? (
          <div className="empty">請選擇日期</div>
        ) : dayRecords.length === 0 || !daySummary ? (
          <div className="empty">{selectedDay} 尚無出勤紀錄</div>
        ) : (
          <div
            className={`attendance-day-card${daySummary.hasOpen ? ' is-open' : ''}`}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <span className={`badge ${daySummary.hasOpen ? 'ok' : 'steel'}`}>
                {daySummary.hasOpen ? '進行中' : '已下班'}
              </span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {formatTaipei(`${selectedDay}T00:00:00+08:00`, 'MM/dd EEEE')}
              </span>
            </div>

            <p className="attendance-day-time">
              {daySummary.earliestIn
                ? formatTaipei(daySummary.earliestIn, 'HH:mm')
                : '—'}
              {' → '}
              {daySummary.hasOpen
                ? '尚未下班'
                : daySummary.latestOut
                  ? formatTaipei(daySummary.latestOut, 'HH:mm')
                  : '—'}
            </p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
              今日累計 {formatWorkDuration(daySummary.totalWorkMs)}
              {daySummary.segmentCount > 1
                ? ` · 共 ${daySummary.segmentCount} 段`
                : ''}
            </p>

            {daySummary.primarySiteId ? (
              <p className="attendance-day-site">
                {siteName(daySummary.primarySiteId)}
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-steel"
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
                onClick={() => {
                  if (openShift && daySummary.hasOpen) {
                    document
                      .getElementById('assign-site')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    return
                  }
                  if (daySummary.primaryRecordId) {
                    fillFromRecord(daySummary.primaryRecordId)
                  }
                }}
              >
                補登工地
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8, paddingLeft: 0, alignSelf: 'flex-start' }}
              onClick={() => setDayTimelineOpen((v) => !v)}
            >
              {dayTimelineOpen ? '收合明細' : '展開明細'}
            </button>

            {dayTimelineOpen ? (
              <div className="attendance-day-detail stack">
                <strong style={{ margin: 0, fontSize: '0.9rem' }}>班次段落</strong>
                {daySummary.segments.map((seg) => (
                  <div key={seg.id} className="attendance-segment">
                    <div className="row between">
                      <span>
                        {formatTaipei(seg.clockInAt, 'HH:mm')}
                        {' → '}
                        {seg.clockOutAt
                          ? formatTaipei(seg.clockOutAt, 'HH:mm')
                          : '進行中'}
                      </span>
                      <span className="muted">
                        {formatWorkDuration(seg.workMs)}
                      </span>
                    </div>
                    <p className="muted" style={{ margin: '2px 0 0' }}>
                      {seg.siteId
                        ? siteName(seg.siteId)
                        : '未指定工地'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: 0, marginTop: 4 }}
                      onClick={() => fillFromRecord(seg.id)}
                    >
                      申請更正
                    </button>
                  </div>
                ))}

                <strong style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                  地點足跡
                </strong>
                {timelineQuery.isLoading ? (
                  <p className="muted" style={{ margin: 0 }}>
                    載入足跡…
                  </p>
                ) : (
                  (() => {
                    const checkins = timelineQuery.data ?? []
                    const primary =
                      dayRecords.find(
                        (r) => r.id === daySummary.primaryRecordId,
                      ) ?? dayRecords[0]
                    const events = buildAttendanceTimeline({
                      attendance: primary,
                      checkins: checkins.map((c) => ({
                        ...c,
                        siteName:
                          c.siteName ||
                          (c.siteId ? siteName(c.siteId) : null),
                      })),
                    })
                    const locOnly = events.filter((e) => e.kind === 'location')
                    const locSummary = summarizeAttendanceDay({
                      clockInAt: daySummary.earliestIn,
                      clockOutAt: daySummary.latestOut,
                      locationCount: locOnly.length,
                    })
                    return (
                      <>
                        <p
                          className="muted"
                          style={{ margin: 0, fontSize: '0.85rem' }}
                        >
                          地點紀錄：
                          {locSummary.locationCount > 0
                            ? `${locSummary.locationCount} 筆`
                            : '當天沒有其他地點紀錄'}
                        </p>
                        {locOnly.map((ev) => (
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
                          </div>
                        ))}
                      </>
                    )
                  })()
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
