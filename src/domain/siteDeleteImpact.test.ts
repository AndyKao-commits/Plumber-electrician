import { describe, expect, it } from 'vitest'
import {
  buildSiteDeleteImpact,
  deletedSiteFinanceLabel,
} from './siteDeleteImpact'

describe('siteDeleteImpact', () => {
  it('blocks when confirmed finance exists', () => {
    const impact = buildSiteDeleteImpact({
      siteId: 's1',
      siteName: 'A案',
      photoCount: 2,
      pendingExpenseCount: 0,
      confirmedExpenseCount: 1,
      pendingReceiptCount: 0,
      confirmedReceiptCount: 0,
      attendanceCount: 3,
      quoteCount: 0,
      defectCount: 0,
    })
    expect(impact.blocked).toBe(true)
    expect(impact.blockReason).toMatch(/結案/)
  })

  it('allows pending-only finance with retain handling', () => {
    const impact = buildSiteDeleteImpact({
      siteId: 's1',
      siteName: 'A案',
      photoCount: 0,
      pendingExpenseCount: 2,
      confirmedExpenseCount: 0,
      pendingReceiptCount: 1,
      confirmedReceiptCount: 0,
      attendanceCount: 0,
      quoteCount: 0,
      defectCount: 0,
    })
    expect(impact.blocked).toBe(false)
    expect(impact.handlingLines.some((l) => l.includes('原案件已刪除'))).toBe(
      true,
    )
  })

  it('labels deleted site finance snapshot', () => {
    expect(deletedSiteFinanceLabel('忠孝東路')).toBe(
      '忠孝東路（原案件已刪除）',
    )
  })
})
