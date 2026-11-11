import { describe, expect, it } from 'vitest'
import { assertCanAccessSite, filterSitesByAccess } from './siteAccess'

describe('site access', () => {
  const sites = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('boss sees all; employee only allowed', () => {
    expect(filterSitesByAccess({ role: 'boss', sites, allowedSiteIds: [] })).toHaveLength(
      3,
    )
    expect(
      filterSitesByAccess({
        role: 'employee',
        sites,
        allowedSiteIds: ['b'],
      }).map((s) => s.id),
    ).toEqual(['b'])
    expect(
      filterSitesByAccess({
        role: 'employee',
        sites,
        allowedSiteIds: [],
      }),
    ).toEqual([])
  })

  it('assertCanAccessSite', () => {
    expect(() =>
      assertCanAccessSite({
        role: 'employee',
        siteId: 'x',
        allowedSiteIds: ['a'],
      }),
    ).toThrow(/無權限/)
    expect(() =>
      assertCanAccessSite({
        role: 'boss',
        siteId: 'x',
        allowedSiteIds: [],
      }),
    ).not.toThrow()
  })
})
