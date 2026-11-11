import { describe, expect, it } from 'vitest'
import {
  buildAttendanceTimeline,
  formatWorkDuration,
  locationPlaceLabel,
  summarizeAttendanceDay,
} from './attendanceTimeline'
import type { AttendanceRecord, LocationCheckin } from './types'

describe('attendance timeline', () => {
  const attendance: AttendanceRecord = {
    id: 'a1',
    organizationId: 'o1',
    userId: 'u1',
    status: 'clocked_out',
    clockInAt: '2026-11-11T00:52:00.000Z',
    clockOutAt: '2026-11-11T09:48:00.000Z',
    siteId: null,
  }

  const checkins: LocationCheckin[] = [
    {
      id: 'l1',
      organizationId: 'o1',
      userId: 'u1',
      recordedAt: '2026-11-11T02:15:00.000Z',
      source: 'line_site',
      siteName: '松江路案場',
      label: '松江路案場',
    },
  ]

  it('orders clock in / location / clock out', () => {
    const events = buildAttendanceTimeline({ attendance, checkins })
    expect(events.map((e) => e.kind)).toEqual([
      'clock_in',
      'location',
      'clock_out',
    ])
    expect(events[1].placeLabel).toContain('松江')
  })

  it('summarizes work duration', () => {
    const s = summarizeAttendanceDay({
      clockInAt: attendance.clockInAt,
      clockOutAt: attendance.clockOutAt,
      locationCount: 1,
    })
    expect(s.workMs).toBeGreaterThan(0)
    expect(formatWorkDuration(s.workMs)).toMatch(/小時/)
  })

  it('labels place fallbacks', () => {
    expect(locationPlaceLabel({ address: '台北市' })).toBe('台北市')
    expect(locationPlaceLabel({ latitude: 25.1, longitude: 121.5 })).toMatch(
      /25\.10000/,
    )
  })
})
