import type {
  AttendanceRecord,
  AttendanceTimelineEvent,
  LocationCheckin,
} from './types'

/** Display label for a footprint row. */
export function locationPlaceLabel(row: {
  siteName?: string | null
  label?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}): string {
  if (row.siteName?.trim()) return row.siteName.trim()
  if (row.address?.trim()) return row.address.trim()
  if (row.label?.trim()) return row.label.trim()
  if (row.latitude != null && row.longitude != null) {
    return `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
  }
  return '未命名位置'
}

export function buildAttendanceTimeline(input: {
  attendance: AttendanceRecord
  checkins: LocationCheckin[]
}): AttendanceTimelineEvent[] {
  const events: AttendanceTimelineEvent[] = []
  const siteFromCheckin = (c: LocationCheckin) =>
    locationPlaceLabel({
      siteName: c.siteName,
      label: c.label,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
    })

  events.push({
    id: `att-in-${input.attendance.id}`,
    kind: 'clock_in',
    at: input.attendance.clockInAt,
    title: '上班打卡',
    placeLabel: input.attendance.siteId ? undefined : '出發上工',
    note: input.attendance.note ?? null,
    latitude: input.attendance.latitude ?? null,
    longitude: input.attendance.longitude ?? null,
  })

  for (const c of input.checkins) {
    const isAttendanceSite = c.source === 'attendance_site'
    events.push({
      id: c.id,
      kind: 'location',
      at: c.recordedAt,
      title: isAttendanceSite ? '到訪工地' : '紀錄地點',
      placeLabel: siteFromCheckin(c),
      address: c.address ?? null,
      note: c.note ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
    })
  }

  if (input.attendance.clockOutAt) {
    events.push({
      id: `att-out-${input.attendance.id}`,
      kind: 'clock_out',
      at: input.attendance.clockOutAt,
      title: '下班打卡',
      placeLabel: null,
      note: null,
    })
  }

  return events.sort((a, b) => a.at.localeCompare(b.at))
}

export function summarizeAttendanceDay(input: {
  clockInAt?: string | null
  clockOutAt?: string | null
  locationCount: number
}): {
  workMs: number | null
  locationCount: number
} {
  if (!input.clockInAt || !input.clockOutAt) {
    return { workMs: null, locationCount: input.locationCount }
  }
  const start = new Date(input.clockInAt).getTime()
  const end = new Date(input.clockOutAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return { workMs: null, locationCount: input.locationCount }
  }
  return { workMs: end - start, locationCount: input.locationCount }
}

export function formatWorkDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—'
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m} 分`
  return `${h} 小時 ${m} 分`
}

export type DayShiftSegment = {
  id: string
  clockInAt: string
  clockOutAt?: string | null
  siteId?: string | null
  status: AttendanceRecord['status']
  workMs: number | null
}

/**
 * Merge same-day shift fragments into one summary for the day card UI.
 * Segments stay available for the expanded timeline.
 */
export function summarizeDayShifts(
  records: Array<
    Pick<
      AttendanceRecord,
      'id' | 'clockInAt' | 'clockOutAt' | 'siteId' | 'status'
    >
  >,
  nowMs: number = Date.now(),
): {
  segments: DayShiftSegment[]
  segmentCount: number
  hasOpen: boolean
  earliestIn: string | null
  latestOut: string | null
  totalWorkMs: number
  primarySiteId: string | null
  missingSiteCount: number
  /** Prefer open shift; else longest closed; else earliest. */
  primaryRecordId: string | null
} {
  const sorted = [...records].sort((a, b) =>
    a.clockInAt.localeCompare(b.clockInAt),
  )
  const segments: DayShiftSegment[] = sorted.map((r) => {
    const start = new Date(r.clockInAt).getTime()
    const end = r.clockOutAt
      ? new Date(r.clockOutAt).getTime()
      : r.status === 'clocked_in'
        ? nowMs
        : NaN
    let workMs: number | null = null
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      workMs = end - start
    }
    return {
      id: r.id,
      clockInAt: r.clockInAt,
      clockOutAt: r.clockOutAt ?? null,
      siteId: r.siteId ?? null,
      status: r.status,
      workMs,
    }
  })

  let totalWorkMs = 0
  let hasOpen = false
  let missingSiteCount = 0
  let primarySiteId: string | null = null
  let longestClosed: DayShiftSegment | null = null

  for (const s of segments) {
    if (s.status === 'clocked_in') hasOpen = true
    if (!s.siteId) missingSiteCount += 1
    if (s.siteId && !primarySiteId) primarySiteId = s.siteId
    if (s.workMs != null) totalWorkMs += s.workMs
    if (s.status !== 'clocked_in' && s.workMs != null) {
      if (!longestClosed || (longestClosed.workMs ?? 0) < s.workMs) {
        longestClosed = s
      }
    }
  }

  // Prefer last non-null site (most recent assignment) when multiple exist.
  for (let i = segments.length - 1; i >= 0; i--) {
    const sid = segments[i].siteId
    if (sid) {
      primarySiteId = sid
      break
    }
  }

  const openSeg = segments.find((s) => s.status === 'clocked_in')
  const primaryRecordId =
    openSeg?.id ?? longestClosed?.id ?? segments[0]?.id ?? null

  const closedOuts = segments
    .map((s) => s.clockOutAt)
    .filter((x): x is string => Boolean(x))
    .sort()

  return {
    segments,
    segmentCount: segments.length,
    hasOpen,
    earliestIn: segments[0]?.clockInAt ?? null,
    latestOut: hasOpen
      ? null
      : closedOuts.length
        ? closedOuts[closedOuts.length - 1]
        : null,
    totalWorkMs,
    primarySiteId,
    missingSiteCount,
    primaryRecordId,
  }
}
