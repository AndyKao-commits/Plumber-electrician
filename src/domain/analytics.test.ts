import { describe, expect, it } from 'vitest'
import {
  assertCanExportOpsStats,
  buildOpsStatsCsv,
  computeOpsStats,
} from './analytics'

const base = {
  issuedBillingTotal: 10000,
  confirmedPaymentsTotal: 8000,
  confirmedRefundsTotal: 500,
  confirmedUsageCostTotal: 1200,
  openRepairs: 2,
  closedRepairs: 5,
  openComplaints: 1,
  escalatedComplaints: 1,
}

describe('ANA-001 營運統計', () => {
  it('只呈現傳入的已確認合計；成本依權限遮罩', () => {
    const owner = computeOpsStats(base, { role: 'boss' })
    expect(owner.netCash).toBe(7500)
    expect(owner.usageCost).toBe(1200)
    expect(owner.recognizedRevenue).toBeNull()

    const member = computeOpsStats(base, { role: 'employee' })
    expect(member.usageCost).toBeNull()
    expect(member.costVisible).toBe(false)
    expect(buildOpsStatsCsv(member)).toContain('（遮罩）')
  })

  it('匯出需團隊／財務權限', () => {
    expect(() => assertCanExportOpsStats('boss')).not.toThrow()
    expect(() => assertCanExportOpsStats('employee')).not.toThrow()
  })
})
