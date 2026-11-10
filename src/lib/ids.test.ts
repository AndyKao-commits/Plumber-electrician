import { describe, expect, it } from 'vitest'
import { isUuid, optionalUuid, requireUuid } from './ids'

describe('uuid guards', () => {
  it('accepts canonical uuids', () => {
    expect(isUuid('22222222-2222-2222-2222-222222222221')).toBe(true)
    expect(requireUuid('22222222-2222-2222-2222-222222222221', '工程')).toBe(
      '22222222-2222-2222-2222-222222222221',
    )
  })

  it('rejects demo ids like site-a', () => {
    expect(isUuid('site-a')).toBe(false)
    expect(() => requireUuid('site-a', '工程')).toThrow(/工程 ID 無效/)
    expect(() => optionalUuid('repair-1', '維修案件')).toThrow(/維修案件 ID 無效/)
  })

  it('optional empty becomes null', () => {
    expect(optionalUuid('', '工地')).toBeNull()
    expect(optionalUuid(null, '工地')).toBeNull()
  })
})
