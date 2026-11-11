import { describe, expect, it } from 'vitest'
import { assertPhotoType, groupPhotosByType } from './photoTypes'

describe('photo types', () => {
  it('asserts and groups', () => {
    expect(assertPhotoType('before')).toBe('before')
    expect(() => assertPhotoType('x')).toThrow(/請選擇照片類型/)
    const g = groupPhotosByType([
      { photoType: 'before' },
      { photoType: null },
      { photoType: 'after' },
    ])
    expect(g.before).toHaveLength(1)
    expect(g.unclassified).toHaveLength(1)
    expect(g.after).toHaveLength(1)
  })
})
