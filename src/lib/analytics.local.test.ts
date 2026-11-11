import { describe, expect, it } from 'vitest'
import { buildOpsStatsCsv, computeOpsStats } from '@/domain/analytics'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb ANA-001', () => {
  it('匯總已確認耗用；Member CSV 遮罩成本', () => {
    const b = boss()
    const mat = localDb.getMaterials()[0]
    const repair = localDb.createRepairCase(
      { id: b.id, name: b.name },
      { problemDescription: `統計-${Date.now()}` },
    )
    localDb.postMaterialUsage(
      { id: b.id },
      {
        materialId: mat.id,
        qty: 1,
        repairCaseId: repair.id,
        clientOperationId: `ana-${Date.now()}`,
      },
    )
    const usages = localDb.listMaterialUsages()
    const cost = usages.reduce((s, u) => s + u.totalCost, 0)
    const owner = computeOpsStats(
      {
        issuedBillingTotal: 0,
        confirmedPaymentsTotal: 0,
        confirmedRefundsTotal: 0,
        confirmedUsageCostTotal: cost,
        openRepairs: localDb
          .getRepairCases()
          .filter((r) => r.status !== 'closed' && r.status !== 'cancelled')
          .length,
        closedRepairs: 0,
        openComplaints: 0,
        escalatedComplaints: 0,
      },
      { role: 'boss' },
    )
    expect(owner.usageCost).toBeGreaterThan(0)
    const memberCsv = buildOpsStatsCsv(
      computeOpsStats(
        {
          issuedBillingTotal: 0,
          confirmedPaymentsTotal: 0,
          confirmedRefundsTotal: 0,
          confirmedUsageCostTotal: cost,
          openRepairs: 1,
          closedRepairs: 0,
          openComplaints: 0,
          escalatedComplaints: 0,
        },
        { role: 'employee' },
      ),
    )
    expect(memberCsv).toContain('（遮罩）')
  })
})
