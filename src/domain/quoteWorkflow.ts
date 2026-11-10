import { roundMoney } from './money'
import type {
  Quotation,
  QuotationItem,
  QuoteExportSnapshot,
  QuoteWorkflowStatus,
  TaxMode,
} from './types'
import { calcQuoteTax, sumQuoteItems } from './rules'

export const QUOTE_WORKFLOW_LABELS: Record<QuoteWorkflowStatus, string> = {
  editing: '編輯中',
  exported: '已匯出',
  sent_to_customer: '已提供客戶',
  accepted: '客戶已接受',
  rejected: '客戶未接受',
  cancelled: '已取消',
}

export const CUSTOMER_ACCEPT_LABELS: Record<QuoteWorkflowStatus, string> = {
  editing: '尚未提供',
  exported: '尚未回覆',
  sent_to_customer: '等待回覆',
  accepted: '已接受',
  rejected: '未接受',
  cancelled: '—',
}

export function isQuoteEditable(
  status: QuoteWorkflowStatus | string | undefined,
): boolean {
  return (
    status === 'editing' ||
    status === 'exported' ||
    status === 'sent_to_customer' ||
    status === 'rejected'
  )
}

export function assertQuoteCaseEditable(input: {
  workflowStatus?: string
}): void {
  if (!isQuoteEditable(input.workflowStatus)) {
    throw new Error('此狀態不可修改報價細項（已接受或已取消）')
  }
}

/** Only 客戶已接受 counts toward effective contract. */
export function effectiveContractAmount(
  quotes: Array<Pick<Quotation, 'workflowStatus' | 'amountAfterTax'>>,
): number {
  let total = 0
  for (const q of quotes) {
    if (q.workflowStatus !== 'accepted') continue
    total = roundMoney(total + (Number(q.amountAfterTax) || 0))
  }
  return total
}

export function calcQuoteTotals(input: {
  items: Array<Pick<QuotationItem, 'amount' | 'kind'>>
  discount?: number
  taxMode: TaxMode
  taxRate?: number
}): {
  subtotal: number
  discount: number
  taxAmount: number
  total: number
  taxRate: number
  byKind: ReturnType<typeof sumQuoteItems>['byKind']
} {
  const { total: subtotal, byKind } = sumQuoteItems(input.items)
  const discount = Math.max(0, Number(input.discount ?? 0) || 0)
  const taxable = Math.max(0, roundMoney(subtotal - discount))
  const tax = calcQuoteTax({
    amountBeforeTax: taxable,
    taxMode: input.taxMode,
    taxRate: input.taxRate,
  })
  return {
    subtotal,
    discount,
    taxAmount: tax.taxAmount,
    total: tax.amountAfterTax,
    taxRate: tax.taxRate,
    byKind,
  }
}

export function buildQuoteExportSnapshot(input: {
  quote: Quotation
  items: QuotationItem[]
  versionNo: number
  quoteDate?: string
}): QuoteExportSnapshot {
  const totals = calcQuoteTotals({
    items: input.items,
    discount: input.quote.discount,
    taxMode: input.quote.taxMode,
    taxRate: input.quote.taxRate,
  })
  return {
    quoteNumber: input.quote.quoteNumber,
    versionNo: input.versionNo,
    quoteDate: input.quoteDate ?? new Date().toISOString().slice(0, 10),
    title: input.quote.title,
    customerName: input.quote.customerName || '—',
    siteAddress: input.quote.siteAddress || '—',
    taxMode: input.quote.taxMode,
    taxRate: totals.taxRate,
    items: input.items
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((i) => ({
        lineNo: i.lineNo,
        kind: i.kind,
        description: i.description,
        qty: i.qty,
        unit: i.unit,
        unitPrice: i.unitPrice,
        amount: i.amount,
      })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxAmount: totals.taxAmount,
    total: totals.total,
    paymentTerms: input.quote.paymentTerms || '依約定',
    validUntil: input.quote.validUntil ?? null,
    notes: input.quote.notes || '',
  }
}

export function legacyStatusFromWorkflow(
  ws: QuoteWorkflowStatus,
): Quotation['status'] {
  if (ws === 'cancelled') return 'void'
  if (ws === 'exported' || ws === 'sent_to_customer' || ws === 'accepted') {
    return 'published'
  }
  return 'draft'
}

export function workflowFromLegacy(
  status: string | null | undefined,
  workflow?: string | null,
): QuoteWorkflowStatus {
  if (
    workflow === 'editing' ||
    workflow === 'exported' ||
    workflow === 'sent_to_customer' ||
    workflow === 'accepted' ||
    workflow === 'rejected' ||
    workflow === 'cancelled'
  ) {
    return workflow
  }
  if (status === 'published') return 'exported'
  if (status === 'void') return 'cancelled'
  return 'editing'
}
