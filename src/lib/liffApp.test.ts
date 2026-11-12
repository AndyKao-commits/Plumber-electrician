import { describe, expect, it } from 'vitest'
import { LIFF_PATHS, isLiffConfigured, liffOpenUrl } from '@/lib/liffApp'

describe('liffApp', () => {
  it('exposes attendance, location, and expense paths', () => {
    expect(LIFF_PATHS.attendance).toBe('/liff/attendance')
    expect(LIFF_PATHS.location).toBe('/liff/location')
    expect(LIFF_PATHS.expense).toBe('/liff/expense')
  })

  it('reports whether LIFF id is configured from env', () => {
    expect(typeof isLiffConfigured()).toBe('boolean')
    expect(typeof isLiffConfigured('location')).toBe('boolean')
  })

  it('builds site path urls when liff id is absent', () => {
    expect(liffOpenUrl('attendance', 'https://example.com')).toBe(
      'https://example.com/liff/attendance',
    )
    expect(liffOpenUrl('location', 'https://example.com')).toBe(
      'https://example.com/liff/location',
    )
  })
})
