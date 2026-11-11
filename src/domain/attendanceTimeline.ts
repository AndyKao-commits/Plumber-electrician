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
    events.push({
      id: c.id,
      kind: 'location',
      at: c.recordedAt,
      title: '紀錄地點',
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
