import { describe, expect, it } from 'vitest'
import {
  MISC_SITE_LABEL,
  MISC_SITE_VALUE,
  assertBossFinalize,
  computeCaseFinance,
  isCaseLinkedCash,
  resolveFieldCashTarget,
} from './fieldFinance'

describe('V1.0 field finance', () => {
  it('case balance = accepted contract − confirmed expense', () => {
    const s = computeCaseFinance({
      acceptedContractAmount: 100_000,
      confirmedExpenseTotal: 35_000,
      pendingExpenseTotal: 5_000,
      confirmedReceiptTotal: 40_000,
      pendingReceiptTotal: 2_000,
    })
    expect(s.caseBalance).toBe(65_000)
    expect(s.pendingExpenseTotal).toBe(5_000)
  })

  it('blocks employee self-finalize', () => {
    expect(() =>
      assertBossFinalize({
        actorRole: 'employee',
        actorId: 'a',
        reporterId: 'b',
      }),
    ).toThrow(/僅老闆/)
    expect(() =>
      assertBossFinalize({
        actorRole: 'boss',
        actorId: 'boss-1',
        reporterId: 'boss-1',
      }),
    ).toThrow(/不可最終審核自己/)
    expect(() =>
      assertBossFinalize({
        actorRole: 'boss',
        actorId: 'boss-1',
        reporterId: 'emp-1',
      }),
    ).not.toThrow()
  })
})

describe('misc field cash target', () => {
  it('resolves misc without site', () => {
    const t = resolveFieldCashTarget({
      siteId: MISC_SITE_VALUE,
      locationText: '中油忠孝站',
    })
    expect(t.siteId).toBeNull()
    expect(t.siteName).toBe(MISC_SITE_LABEL)
    expect(t.locationText).toBe('中油忠孝站')
    expect(t.isMisc).toBe(true)
  })

  it('requires site when not misc', () => {
    expect(() => resolveFieldCashTarget({ siteId: '', siteName: '' })).toThrow(
      /請選擇工地/,
    )
    const t = resolveFieldCashTarget({ siteId: 's1' })
    expect(t.isMisc).toBe(false)
    expect(t.siteId).toBe('s1')
  })

  it('case-linked filter ignores misc', () => {
    expect(isCaseLinkedCash({ siteId: 's1' })).toBe(true)
    expect(isCaseLinkedCash({ siteId: null })).toBe(false)
  })
})
