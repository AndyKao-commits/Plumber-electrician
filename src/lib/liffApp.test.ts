import { describe, expect, it } from 'vitest'
import { LIFF_PATHS, isLiffConfigured, liffOpenUrl } from '@/lib/liffApp'

describe('liffApp', () => {
  it('exposes attendance and location paths', () => {
    expect(LIFF_PATHS.attendance).toBe('/liff/attendance')
    expect(LIFF_PATHS.location).toBe('/liff/location')
  })

  it('reports whether LIFF id is configured from env', () => {
    expect(typeof isLiffConfigured()).toBe('boolean')
  })

  it('builds site path urls when liff id is absent', () => {
    expect(liffOpenUrl('attendance', 'https://example.com')).toMatch(
      /\/liff\/attendance$/,
    )
  })
})
