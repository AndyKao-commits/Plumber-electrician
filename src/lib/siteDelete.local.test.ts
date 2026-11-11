import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

describe('site delete local', () => {
  it('boss can delete a site; employee cannot', () => {
    const boss = localDb.getUsers().find((u) => u.role === 'boss')!
    const employee = localDb.getUsers().find((u) => u.role === 'employee')!
    const id = `site-del-${crypto.randomUUID()}`
    localDb.upsertSite({
      id,
      organizationId: localDb.orgId,
      name: '待刪案件',
      kind: 'formal',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    })
    expect(localDb.getSite(id)?.name).toBe('待刪案件')

    expect(() => localDb.deleteSite(employee, id)).toThrow(/無權使用/)
    localDb.deleteSite(boss, id)
    expect(localDb.getSite(id)).toBeNull()
  })
})
