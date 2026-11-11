import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

describe('site close local', () => {
  it('boss can close and reopen; employee cannot', () => {
    const boss = localDb.getUsers().find((u) => u.role === 'boss')!
    const employee = localDb.getUsers().find((u) => u.role === 'employee')!
    const site = localDb.getSites()[0]
    expect(site).toBeTruthy()

    const closed = localDb.updateSiteStatus(boss, site.id, 'closed')
    expect(closed.status).toBe('closed')

    expect(() =>
      localDb.updateSiteStatus(employee, site.id, 'active'),
    ).toThrow(/僅老闆/)

    const reopened = localDb.updateSiteStatus(boss, site.id, 'active')
    expect(reopened.status).toBe('active')
  })
})
