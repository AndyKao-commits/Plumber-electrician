import { describe, expect, it } from 'vitest'
import {
  calcQuoteTotals,
  effectiveContractAmount,
  isQuoteEditable,
} from './quoteWorkflow'

describe('quote case workflow', () => {
  it('only accepted counts toward contract', () => {
    expect(
      effectiveContractAmount([
        { workflowStatus: 'editing', amountAfterTax: 1000 },
        { workflowStatus: 'exported', amountAfterTax: 2000 },
        { workflowStatus: 'sent_to_customer', amountAfterTax: 3000 },
        { workflowStatus: 'rejected', amountAfterTax: 4000 },
        { workflowStatus: 'cancelled', amountAfterTax: 5000 },
        { workflowStatus: 'accepted', amountAfterTax: 6000 },
      ]),
    ).toBe(6000)
  })

  it('editable except accepted/cancelled', () => {
    expect(isQuoteEditable('editing')).toBe(true)
    expect(isQuoteEditable('exported')).toBe(true)
    expect(isQuoteEditable('accepted')).toBe(false)
    expect(isQuoteEditable('cancelled')).toBe(false)
  })

  it('applies discount before tax', () => {
    const t = calcQuoteTotals({
      items: [
        { kind: 'material', amount: 10000 },
        { kind: 'labor', amount: 5000 },
      ],
      discount: 1000,
      taxMode: 'exclusive',
      taxRate: 0.05,
    })
    expect(t.subtotal).toBe(15000)
    expect(t.discount).toBe(1000)
    expect(t.taxAmount).toBe(700)
    expect(t.total).toBe(14700)
  })
})
