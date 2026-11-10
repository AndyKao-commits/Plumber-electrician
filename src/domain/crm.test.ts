import { describe, expect, it } from 'vitest'
import {
  assertCanLinkCustomerToSite,
  assertCustomerName,
  canCreateCustomerWithNameOnly,
  customersSharingSite,
} from './crm'

describe('CRM-001 客戶／地址', () => {
  it('只需名稱可建客戶', () => {
    expect(assertCustomerName('  王太太  ')).toBe('王太太')
    expect(canCreateCustomerWithNameOnly({ name: '王太太' })).toEqual({
      ok: true,
      name: '王太太',
    })
    expect(canCreateCustomerWithNameOnly({ name: '  ' }).ok).toBe(false)
  })

  it('多客戶可同址；同一客戶不可重複關聯', () => {
    const links = [
      { customerId: 'c1', siteId: 's1' },
      { customerId: 'c2', siteId: 's1' },
    ]
    expect(customersSharingSite('s1', links)).toEqual(['c1', 'c2'])
    expect(() =>
      assertCanLinkCustomerToSite({
        customerId: 'c3',
        siteId: 's1',
        existingLinks: links,
      }),
    ).not.toThrow()
    expect(() =>
      assertCanLinkCustomerToSite({
        customerId: 'c1',
        siteId: 's1',
        existingLinks: links,
      }),
    ).toThrow(/已關聯/)
  })
})
