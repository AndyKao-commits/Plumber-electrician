import { describe, expect, it } from 'vitest'
import { mapsNavigationUrl } from './mapsNav'

describe('mapsNavigationUrl', () => {
  it('builds Google Maps directions URL', () => {
    const url = mapsNavigationUrl('台北市內湖區成功路')
    expect(url).toContain('https://www.google.com/maps/dir/')
    expect(url).toContain(encodeURIComponent('台北市內湖區成功路'))
  })

  it('returns null for blank address', () => {
    expect(mapsNavigationUrl('   ')).toBeNull()
  })
})
