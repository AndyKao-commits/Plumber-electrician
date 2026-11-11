import { describe, expect, it } from 'vitest'
import { taipeiDateString } from './time'

describe('taipeiDateString', () => {
  it('formats a fixed UTC instant as Taipei calendar date', () => {
    // 2026-11-10 16:00 UTC = 2026-11-11 00:00 Taipei
    expect(taipeiDateString('2026-11-10T16:00:00.000Z')).toBe('2026-11-11')
  })

  it('keeps evening UTC on same Taipei date before midnight', () => {
    // 2026-11-10 10:00 UTC = 2026-11-10 18:00 Taipei
    expect(taipeiDateString('2026-11-10T10:00:00.000Z')).toBe('2026-11-10')
  })
})
