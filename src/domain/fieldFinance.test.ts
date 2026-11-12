import { describe, expect, it } from 'vitest'
import {
  MISC_SITE_LABEL,
  MISC_SITE_VALUE,
  assertBossCancelFinance,
  assertBossFinalize,
  assertCanCancelExpense,
  assertCanCancelReceipt,
  buildCashLedger,
  computeCaseFinance,
  computeSiteReceiptProgress,
  filterCashLedger,
  isCaseLinkedCash,
  nextSiteReceiptSequence,
  pickAutoQuoteId,
  receiptConfirmOverContractWarning,
  resolveFieldCashTarget,
  summarizeLedger,
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

  it('boss may cancel confirmed finance; employees may not', () => {
    expect(() => assertBossCancelFinance('employee')).toThrow(/僅老闆/)
    expect(() => assertBossCancelFinance('boss')).not.toThrow()
    expect(() => assertCanCancelExpense('confirmed')).not.toThrow()
    expect(() => assertCanCancelExpense('cancelled')).toThrow(/已取消/)
    expect(() => assertCanCancelReceipt('confirmed')).not.toThrow()
    expect(() => assertCanCancelReceipt('cancelled')).toThrow(/已取消/)
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

describe('site receipt progress', () => {
  it('assigns next sequence from max existing; gaps OK', () => {
    expect(
      nextSiteReceiptSequence(
        [
          { siteId: 's1', status: 'confirmed', siteSequenceNo: 1 },
          { siteId: 's1', status: 'cancelled', siteSequenceNo: 2 },
          { siteId: 's1', status: 'confirmed', siteSequenceNo: 3 },
          { siteId: 's2', status: 'confirmed', siteSequenceNo: 9 },
        ],
        's1',
      ),
    ).toBe(4)
    expect(nextSiteReceiptSequence([], 's1')).toBe(1)
    expect(nextSiteReceiptSequence([], null)).toBeNull()
  })

  it('computes amount progress and over-receive warning', () => {
    const p = computeSiteReceiptProgress({
      siteId: 's1',
      contractAmount: 100_000,
      receipts: [
        { siteId: 's1', status: 'confirmed', amount: 40_000, siteSequenceNo: 1 },
        { siteId: 's1', status: 'pending_confirm', amount: 10_000 },
        { siteId: 's1', status: 'confirmed', amount: 70_000, siteSequenceNo: 2 },
      ],
    })
    expect(p.confirmedTotal).toBe(110_000)
    expect(p.pendingTotal).toBe(10_000)
    expect(p.overReceived).toBe(true)
    expect(p.remaining).toBe(-10_000)
    expect(p.nextSequence).toBe(3)

    expect(
      receiptConfirmOverContractWarning({
        contractAmount: 100_000,
        alreadyConfirmedTotal: 90_000,
        confirmingAmount: 20_000,
      }),
    ).toMatch(/超收/)
    expect(
      receiptConfirmOverContractWarning({
        contractAmount: 0,
        alreadyConfirmedTotal: 0,
        confirmingAmount: 1000,
      }),
    ).toBeNull()
  })

  it('auto-picks quote only when exactly one accepted for site', () => {
    expect(
      pickAutoQuoteId(
        [
          {
            id: 'q1',
            projectId: 's1',
            workflowStatus: 'accepted',
          },
        ],
        's1',
      ),
    ).toBe('q1')
    expect(
      pickAutoQuoteId(
        [
          { id: 'q1', projectId: 's1', workflowStatus: 'accepted' },
          { id: 'q2', projectId: 's1', workflowStatus: 'accepted' },
        ],
        's1',
      ),
    ).toBeNull()
  })

  it('builds and filters monthly ledger', () => {
    const rows = buildCashLedger({
      expenses: [
        {
          id: 'e1',
          siteId: 's1',
          siteName: 'A工地',
          item: '水泥',
          amount: 500,
          status: 'confirmed',
          reportedByName: '小明',
          reportedAt: '2026-11-05T02:00:00.000Z',
        },
      ],
      receipts: [
        {
          id: 'r1',
          siteId: 's1',
          siteName: 'A工地',
          amount: 3000,
          receivedOn: '2026-11-10',
          siteSequenceNo: 1,
          status: 'confirmed',
          reportedByName: '小華',
          reportedAt: '2026-11-10T04:00:00.000Z',
          sourceNote: '先收',
        },
      ],
      expenseDate: () => '2026-11-05',
    })
    expect(rows).toHaveLength(2)
    const nov = filterCashLedger(rows, { month: '2026-11', kind: 'all', status: 'all' })
    expect(summarizeLedger(nov).receiptTotal).toBe(3000)
    expect(summarizeLedger(nov).expenseTotal).toBe(500)
    expect(summarizeLedger(nov).net).toBe(2500)

    const withCancelled = buildCashLedger({
      expenses: [
        {
          id: 'e2',
          siteId: null,
          siteName: '雜項',
          item: '吃飯',
          amount: 5564,
          status: 'cancelled',
          reportedByName: '小明',
          reportedAt: '2026-11-13T02:00:00.000Z',
        },
      ],
      receipts: [],
      expenseDate: () => '2026-11-13',
    })
    const active = filterCashLedger(withCancelled, { status: 'active' })
    expect(active).toHaveLength(0)
    const all = filterCashLedger(withCancelled, { status: 'all' })
    expect(all).toHaveLength(1)
    expect(summarizeLedger(all).expenseTotal).toBe(0)
    expect(summarizeLedger(all).cancelledCount).toBe(1)
  })
})
