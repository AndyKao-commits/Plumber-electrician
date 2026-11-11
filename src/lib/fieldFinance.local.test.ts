import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  return localDb.getUsers().find((u) => u.role === 'boss')!
}

function worker() {
  return localDb.getUsers().find((u) => u.role === 'employee')!
}

describe('V1.0 field finance local', () => {
  it('employee reports expense; boss confirms; self-finalize blocked', () => {
    const b = boss()
    const w = worker()
    const site = localDb.getSites()[0]
    const exp = localDb.createExpenseReport(w, {
      siteId: site.id,
      item: `現場材料-${Date.now()}`,
      amount: 800,
    })
    expect(exp.status).toBe('pending_review')
    expect(() =>
      localDb.reviewExpenseReport(w, { id: exp.id, decision: 'confirm' }),
    ).toThrow(/僅老闆/)
    localDb.reviewExpenseReport(b, { id: exp.id, decision: 'confirm' })
    expect(
      localDb.listExpenseReports().find((e) => e.id === exp.id)?.status,
    ).toBe('confirmed')

    const rc = localDb.createCashReceipt(w, {
      siteId: site.id,
      amount: 2000,
      sourceNote: '客戶現金',
    })
    expect(() =>
      localDb.confirmCashReceipt(b, {
        id: rc.id,
        decision: 'confirm',
      }),
    ).not.toThrow()
    expect(localDb.listAuditLogs().length).toBeGreaterThan(0)
  })
})
