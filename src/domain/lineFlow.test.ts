import { describe, expect, it } from 'vitest'
import {
  EXPIRE_AFTER_MS,
  PAUSE_AFTER_MS,
  classifyActivityAge,
  parseMenuIntent,
  parsePostbackData,
  photoTypeFromLabelOrCode,
  summarizePhotoDraft,
} from './lineFlow'

describe('LINE flow activity age', () => {
  const now = Date.parse('2026-11-10T12:00:00+08:00')

  it('≤30m stays fresh', () => {
    expect(
      classifyActivityAge(new Date(now - PAUSE_AFTER_MS + 1000).toISOString(), now),
    ).toBe('fresh')
  })

  it('>30m and ≤24h → paused', () => {
    expect(
      classifyActivityAge(new Date(now - PAUSE_AFTER_MS - 1000).toISOString(), now),
    ).toBe('paused')
    expect(
      classifyActivityAge(new Date(now - EXPIRE_AFTER_MS + 1000).toISOString(), now),
    ).toBe('paused')
  })

  it('>24h → expired', () => {
    expect(
      classifyActivityAge(new Date(now - EXPIRE_AFTER_MS - 1000).toISOString(), now),
    ).toBe('expired')
  })
})

describe('LINE menu / postback parse', () => {
  it('recognizes photo/todos/attendance/field-cash intents', () => {
    expect(parseMenuIntent('上傳照片')).toBe('photo_upload')
    expect(parseMenuIntent('待辦事項')).toBe('todos')
    expect(parseMenuIntent('出勤打卡')).toBe('attendance')
    expect(parseMenuIntent('採購申請')).toBe('purchase')
    expect(parseMenuIntent('支出回報')).toBe('purchase')
    expect(parseMenuIntent('收款')).toBe('purchase')
    expect(parseMenuIntent('取消操作')).toBe('cancel')
    expect(parseMenuIntent('繼續')).toBe('resume')
    expect(parseMenuIntent('你好')).toBeNull()
  })

  it('parses postback query', () => {
    expect(parsePostbackData('a=switch&to=todos')).toEqual({
      a: 'switch',
      to: 'todos',
    })
  })

  it('maps photo type labels', () => {
    expect(photoTypeFromLabelOrCode('施工前')).toBe('before')
    expect(photoTypeFromLabelOrCode('during')).toBe('during')
    expect(photoTypeFromLabelOrCode('x')).toBeNull()
  })
})

describe('photo draft summary', () => {
  it('lists filled vs pending', () => {
    const s = summarizePhotoDraft({
      siteName: '忠孝東路',
      photoType: 'before',
      photoCount: 2,
      step: 'receiving',
    })
    expect(s.filled).toContain('工地')
    expect(s.filled).toContain('2 張')
    expect(s.pending).toContain('完成上傳')
  })
})
