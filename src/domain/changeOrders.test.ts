import { describe, expect, it } from 'vitest'
import {
  canCreateChangeOrder,
  effectiveContractAmountWithChangeOrders,
  signedChangeOrderAmount,
} from './changeOrders'

describe('FIN-002 追加減與有效合約', () => {
  it('未接受追加減不計入合約', () => {
    const total = effectiveContractAmountWithChangeOrders({
      quotes: [{ workflowStatus: 'accepted', amountAfterTax: 10000 }],
      changeOrders: [
        {
          status: 'draft',
          kind: 'addition',
          amountAfterTax: 3000,
        },
        {
          status: 'sent_to_customer',
          kind: 'addition',
          amountAfterTax: 2000,
        },
        {
          status: 'rejected',
          kind: 'reduction',
          amountAfterTax: 500,
        },
      ],
    })
    expect(total).toBe(10000)
  })

  it('已接受追加加總、追減扣減', () => {
    const total = effectiveContractAmountWithChangeOrders({
      quotes: [
        { workflowStatus: 'accepted', amountAfterTax: 10000 },
        { workflowStatus: 'exported', amountAfterTax: 99999 },
      ],
      changeOrders: [
        { status: 'accepted', kind: 'addition', amountAfterTax: 2000 },
        { status: 'accepted', kind: 'reduction', amountAfterTax: 500 },
      ],
    })
    expect(total).toBe(11500)
    expect(
      signedChangeOrderAmount({
        status: 'accepted',
        kind: 'reduction',
        amountAfterTax: 500,
      }),
    ).toBe(-500)
  })

  it('僅已接受報價可建立追加減；Member 可建立草稿', () => {
    expect(
      canCreateChangeOrder('member', {
        workflowStatus: 'accepted',
        deletedAt: null,
      }).ok,
    ).toBe(true)
    expect(
      canCreateChangeOrder('admin', {
        workflowStatus: 'exported',
        deletedAt: null,
      }).ok,
    ).toBe(false)
    expect(
      canCreateChangeOrder('employee', {
        workflowStatus: 'editing',
        deletedAt: null,
      }).ok,
    ).toBe(false)
  })
})
