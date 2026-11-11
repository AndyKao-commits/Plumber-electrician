import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  return localDb.getUsers().find((u) => u.role === 'boss')!
}

function worker() {
  return localDb.getUsers().find((u) => u.role === 'employee')!
}

describe('V1.0 field finance local', () => {
  it('small expense under review threshold auto-confirms; large needs boss', () => {
    const b = boss()
    const w = worker()
    const site = localDb.getSites()[0]
    const settings = localDb.getOrgSpendSettings()

    const small = localDb.createExpenseReport(w, {
      siteId: site.id,
      item: `現場材料小額-${Date.now()}`,
      amount: Math.max(1, settings.reportReviewThresholdNtd - 1),
    })
    expect(small.status).toBe('confirmed')
    expect(small.reviewNote).toMatch(/小額免審/)

    const large = localDb.createExpenseReport(w, {
      siteId: site.id,
      item: `現場材料大額-${Date.now()}`,
      amount: settings.reportReviewThresholdNtd,
    })
    expect(large.status).toBe('pending_review')
    expect(() =>
      localDb.reviewExpenseReport(w, { id: large.id, decision: 'confirm' }),
    ).toThrow(/僅老闆/)
    localDb.reviewExpenseReport(b, { id: large.id, decision: 'confirm' })
    expect(
      localDb.listExpenseReports().find((e) => e.id === large.id)?.status,
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

  it('boss can set daily purchase and emergency limits', () => {
    const b = boss()
    const before = localDb.getOrgSpendSettings()
    const next = localDb.updateOrgSpendSettings(b, {
      reportReviewThresholdNtd: 2500,
      emergencySingleLimitNtd: 4000,
      emergencyDailyLimitNtd: 8000,
      dailyPurchaseLimitNtd: 15000,
    })
    expect(next.reportReviewThresholdNtd).toBe(2500)
    expect(next.dailyPurchaseLimitNtd).toBe(15000)
    expect(() =>
      localDb.updateOrgSpendSettings(worker(), {
        reportReviewThresholdNtd: 1000,
        emergencySingleLimitNtd: 4000,
        emergencyDailyLimitNtd: 8000,
        dailyPurchaseLimitNtd: 0,
      }),
    ).toThrow(/僅老闆/)
    localDb.updateOrgSpendSettings(b, {
      reportReviewThresholdNtd: before.reportReviewThresholdNtd,
      emergencySingleLimitNtd: before.emergencySingleLimitNtd,
      emergencyDailyLimitNtd: before.emergencyDailyLimitNtd,
      dailyPurchaseLimitNtd: before.dailyPurchaseLimitNtd,
    })
  })
})
