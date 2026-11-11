import { describe, expect, it } from 'vitest'
import {
  assertBossFinalize,
  computeCaseFinance,
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
