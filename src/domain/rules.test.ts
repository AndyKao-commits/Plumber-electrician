import { describe, expect, it } from 'vitest'
import { assertCanApprovePurchase, canApprovePurchase } from './approvals'
import {
  assertEmergencyReserveAllowed,
  shouldAutoReleaseOnRefund,
  sumOccupiedQuota,
} from './emergencyLimits'
import {
  applyInboundMovingAverage,
  applyReturnAgainstInbound,
} from './inventoryCost'
import {
  assertQuoteAssociation,
  assertQuoteDraftEditable,
  calcFinalPayable,
  calcQuoteItemAmount,
  calcQuoteTax,
  requiresPreApproval,
  sumQuoteItems,
} from './rules'

describe('POL-001 final payable', () => {
  it('includes discount tax shipping', () => {
    expect(
      calcFinalPayable({
        goodsAmount: 3000,
        discount: 200,
        tax: 140,
        shipping: 100,
      }),
    ).toBe(3040)
    expect(requiresPreApproval(3040)).toBe(true)
    expect(requiresPreApproval(2999.99)).toBe(false)
  })
})

describe('REV-04 emergency limit events', () => {
  it('blocks over daily quota using event sum', () => {
    expect(() =>
      assertEmergencyReserveAllowed({
        eventsForDay: [
          {
            id: '1',
            organizationId: 'o',
            employeeId: 'e',
            businessDate: '2026-11-10',
            type: 'RESERVE',
            amountDelta: 6000,
            createdAt: '',
            createdBy: 'e',
          },
        ],
        reserveAmount: 5000,
      }),
    ).toThrow(/每日/)
  })

  it('RELEASE reduces occupied quota', () => {
    expect(
      sumOccupiedQuota([
        {
          id: '1',
          organizationId: 'o',
          employeeId: 'e',
          businessDate: '2026-11-10',
          type: 'RESERVE',
          amountDelta: 4800,
          createdAt: '',
          createdBy: 'e',
        },
        {
          id: '2',
          organizationId: 'o',
          employeeId: 'e',
          businessDate: '2026-11-10',
          type: 'RELEASE',
          amountDelta: -4800,
          createdAt: '',
          createdBy: 'boss',
        },
      ]),
    ).toBe(0)
  })

  it('refunds do not auto-release', () => {
    expect(shouldAutoReleaseOnRefund()).toBe(false)
  })
})

describe('REV-03 / REV-01 quotes', () => {
  it('requires tax mode math', () => {
    const exclusive = calcQuoteTax({
      amountBeforeTax: 10000,
      taxMode: 'exclusive',
    })
    expect(exclusive.taxAmount).toBe(500)
    expect(exclusive.amountAfterTax).toBe(10500)
  })

  it('enforces XOR association', () => {
    expect(() => assertQuoteAssociation({})).toThrow(/XOR/)
    expect(() =>
      assertQuoteAssociation({ projectId: 'a', repairCaseId: 'b' }),
    ).toThrow(/XOR/)
    expect(() => assertQuoteAssociation({ projectId: 'a' })).not.toThrow()
  })
})

describe('FIN-02 quote line items', () => {
  it('computes line amount from qty × unitPrice', () => {
    expect(calcQuoteItemAmount({ qty: 3, unitPrice: 250 })).toBe(750)
  })

  it('sums material and labor once without double-counting', () => {
    const summed = sumQuoteItems([
      { kind: 'material', amount: 4000 },
      { kind: 'labor', amount: 6000 },
      { kind: 'other', amount: 500 },
    ])
    expect(summed.total).toBe(10500)
    expect(summed.byKind.material).toBe(4000)
    expect(summed.byKind.labor).toBe(6000)
    expect(summed.byKind.other).toBe(500)
  })

  it('blocks edits when accepted or cancelled', () => {
    expect(() =>
      assertQuoteDraftEditable({ workflowStatus: 'accepted' }),
    ).toThrow(/不可修改/)
    expect(() =>
      assertQuoteDraftEditable({ workflowStatus: 'cancelled' }),
    ).toThrow(/不可修改/)
    expect(() =>
      assertQuoteDraftEditable({ workflowStatus: 'editing' }),
    ).not.toThrow()
    expect(() =>
      assertQuoteDraftEditable({ workflowStatus: 'exported' }),
    ).not.toThrow()
  })
})

describe('REV-06 moving average', () => {
  it('updates weighted average', () => {
    const next = applyInboundMovingAverage({
      oldQty: 10,
      oldUnitCost: 100,
      inboundQty: 10,
      inboundUnitCost: 120,
    })
    expect(next.qty).toBe(20)
    expect(next.unitCost).toBe(110)
  })

  it('zero stock uses new batch cost', () => {
    const next = applyInboundMovingAverage({
      oldQty: 0,
      oldUnitCost: 999,
      inboundQty: 5,
      inboundUnitCost: 40,
    })
    expect(next.unitCost).toBe(40)
  })

  it('return keeps pool unit cost and emits adjustment', () => {
    const result = applyReturnAgainstInbound({
      poolQty: 20,
      poolUnitCost: 110,
      returnQty: 5,
      originalInboundUnitCost: 120,
    })
    expect(result.qty).toBe(15)
    expect(result.unitCost).toBe(110)
    expect(result.costAdjustment).toBe(-50)
  })
})

describe('REV-07 self approval', () => {
  it('denies requester approving self', () => {
    expect(
      canApprovePurchase({
        actorRole: 'boss',
        actorId: 'u1',
        requesterId: 'u1',
      }),
    ).toBe(false)
    expect(() =>
      assertCanApprovePurchase({
        actorRole: 'boss',
        actorId: 'u1',
        requesterId: 'u1',
      }),
    ).toThrow(/自行核准/)
  })

  it('allows boss approving others', () => {
    expect(
      canApprovePurchase({
        actorRole: 'boss',
        actorId: 'boss',
        requesterId: 'worker',
      }),
    ).toBe(true)
  })
})
