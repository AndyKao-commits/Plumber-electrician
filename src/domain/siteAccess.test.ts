import { describe, expect, it } from 'vitest'
import { assertCanAccessSite, filterSitesByAccess } from './siteAccess'

describe('site access', () => {
  const sites = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('boss sees all; employee only allowed when org ACL is on', () => {
    expect(filterSitesByAccess({ role: 'boss', sites, allowedSiteIds: [] })).toHaveLength(
      3,
    )
    expect(
      filterSitesByAccess({
        role: 'employee',
        sites,
        allowedSiteIds: ['b'],
        orgHasAssignments: true,
      }).map((s) => s.id),
    ).toEqual(['b'])
    expect(
      filterSitesByAccess({
        role: 'employee',
        sites,
        allowedSiteIds: [],
        orgHasAssignments: true,
      }),
    ).toEqual([])
  })

  it('bootstrap: no org assignments yet → employee still sees all', () => {
    expect(
      filterSitesByAccess({
        role: 'employee',
        sites,
        allowedSiteIds: [],
        orgHasAssignments: false,
      }),
    ).toHaveLength(3)
  })

  it('assertCanAccessSite', () => {
    expect(() =>
      assertCanAccessSite({
        role: 'employee',
        siteId: 'x',
        allowedSiteIds: ['a'],
        orgHasAssignments: true,
      }),
    ).toThrow(/無權限/)
    expect(() =>
      assertCanAccessSite({
        role: 'boss',
        siteId: 'x',
        allowedSiteIds: [],
      }),
    ).not.toThrow()
    expect(() =>
      assertCanAccessSite({
        role: 'employee',
        siteId: 'a',
        allowedSiteIds: [],
        orgHasAssignments: false,
      }),
    ).not.toThrow()
  })
})
