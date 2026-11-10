import { describe, expect, it } from 'vitest'
import { customersSharingSite } from '@/domain/crm'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb CRM-001', () => {
  it('只需名稱可建客戶；多客戶可同址', () => {
    const b = boss()
    const sites = localDb.getSites()
    const site = sites[0]
    if (!site) throw new Error('no site')

    const a = localDb.createCustomer(
      { id: b.id },
      { name: `客戶A-${Date.now()}` },
    )
    const c = localDb.createCustomer(
      { id: b.id },
      { name: `客戶B-${Date.now()}`, phone: '0911000111' },
    )
    expect(a.phone ?? null).toBeNull()

    localDb.linkCustomerToSite({ id: b.id }, { customerId: a.id, siteId: site.id })
    localDb.linkCustomerToSite({ id: b.id }, { customerId: c.id, siteId: site.id })
    expect(() =>
      localDb.linkCustomerToSite(
        { id: b.id },
        { customerId: a.id, siteId: site.id },
      ),
    ).toThrow(/已關聯/)

    const links = localDb.listCustomerSiteLinks()
    expect(customersSharingSite(site.id, links).length).toBeGreaterThanOrEqual(2)

    localDb.addCustomerContact(
      { id: b.id },
      { customerId: a.id, name: '王先生', phone: '02-123', isPrimary: true },
    )
    expect(localDb.listCustomerContacts(a.id)[0]?.isPrimary).toBe(true)
  })
})
