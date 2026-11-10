import { roundMoney } from './money'
import { hasPermission, PERMISSIONS, type SpecRole } from './permissions'
import type {
  BillingDocument,
  BillingDocumentItem,
  BillingDocumentSnapshot,
  BillingMilestone,
  ChangeOrder,
  Quotation,
  TaxMode,
  UserRole,
} from './types'
import { effectiveContractAmountWithChangeOrders } from './changeOrders'
import { calcQuoteTax } from './rules'

export const BILLING_MILESTONE_STATUS_LABELS: Record<
  BillingMilestone['status'],
  string
> = {
  planned: '待請款',
  billed: '已開立請款',
  cancelled: '已取消',
}

export const BILLING_DOCUMENT_STATUS_LABELS: Record<
  BillingDocument['status'],
  string
> = {
  draft: '草稿',
  issued: '已開立',
  void: '作廢',
}

export function canManageBilling(
  role: UserRole | SpecRole | string,
): boolean {
  return hasPermission(role, PERMISSIONS.BILLING_MANAGE)
}

export function assertCanManageBilling(
  role: UserRole | SpecRole | string,
): void {
  if (!canManageBilling(role)) {
    throw new Error('無權管理請款單（僅老闆／管理員）')
  }
}

export function canCreateBillingForQuote(
  quote: Pick<Quotation, 'workflowStatus' | 'deletedAt'>,
): { ok: true } | { ok: false; reason: string } {
  if (quote.deletedAt) return { ok: false, reason: '報價案件已刪除' }
  if (quote.workflowStatus !== 'accepted') {
    return {
      ok: false,
      reason: '僅「客戶已接受」的報價可建立請款節點',
    }
  }
  return { ok: true }
}

export function isBillingDocumentEditable(
  status: BillingDocument['status'] | string | undefined,
): boolean {
  return status === 'draft'
}

export function assertBillingDocumentEditable(input: {
  status?: string
}): void {
  if (!isBillingDocumentEditable(input.status)) {
    throw new Error('正式請款單已凍結，不可修改（請款 ≠ 收款）')
  }
}

/** Sum of issued billing documents (operational AR request, not cash). */
export function sumIssuedBillingAmount(
  docs: Array<Pick<BillingDocument, 'status' | 'amountAfterTax'>>,
): number {
  let total = 0
  for (const d of docs) {
    if (d.status !== 'issued') continue
    total = roundMoney(total + (Number(d.amountAfterTax) || 0))
  }
  return total
}

export function billingRemainingAgainstContract(input: {
  quotes: Array<Pick<Quotation, 'workflowStatus' | 'amountAfterTax'>>
  changeOrders?: Array<
    Pick<ChangeOrder, 'status' | 'kind' | 'amountAfterTax'>
  >
  billingDocuments: Array<Pick<BillingDocument, 'status' | 'amountAfterTax'>>
}): { contract: number; billed: number; remaining: number } {
  const contract = effectiveContractAmountWithChangeOrders({
    quotes: input.quotes,
    changeOrders: input.changeOrders,
  })
  const billed = sumIssuedBillingAmount(input.billingDocuments)
  return {
    contract,
    billed,
    remaining: roundMoney(contract - billed),
  }
}

export function assertIssueDoesNotExceedContract(input: {
  contract: number
  alreadyIssued: number
  issuingAmount: number
}): void {
  const next = roundMoney(input.alreadyIssued + input.issuingAmount)
  if (next > roundMoney(input.contract) + 0.009) {
    throw new Error(
      `請款合計不可超過有效合約金額（合約 NT$${input.contract.toLocaleString()}，已請 NT$${input.alreadyIssued.toLocaleString()}）`,
    )
  }
}

export function calcBillingTotals(input: {
  items: Array<Pick<BillingDocumentItem, 'amount'>>
  taxMode: TaxMode
  taxRate?: number
}): {
  amountBeforeTax: number
  taxAmount: number
  amountAfterTax: number
  taxRate: number
} {
  const subtotal = roundMoney(
    input.items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
  )
  const tax = calcQuoteTax({
    amountBeforeTax: subtotal,
    taxMode: input.taxMode,
    taxRate: input.taxRate,
  })
  return {
    amountBeforeTax: subtotal,
    taxAmount: tax.taxAmount,
    amountAfterTax: tax.amountAfterTax,
    taxRate: tax.taxRate,
  }
}

export function buildBillingSnapshot(input: {
  document: BillingDocument
  milestone: BillingMilestone
  quote: Pick<Quotation, 'quoteNumber' | 'customerName'>
  items: BillingDocumentItem[]
  issuedAt: string
}): BillingDocumentSnapshot {
  return {
    documentNumber: input.document.documentNumber,
    milestoneCode: input.milestone.code,
    milestoneTitle: input.milestone.title,
    quoteNumber: input.quote.quoteNumber,
    title: input.document.title,
    customerName: input.quote.customerName || '—',
    issuedAt: input.issuedAt,
    taxMode: input.document.taxMode,
    taxRate: input.document.taxRate,
    items: input.items
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((i) => ({
        lineNo: i.lineNo,
        description: i.description,
        qty: i.qty,
        unit: i.unit,
        unitPrice: i.unitPrice,
        amount: i.amount,
      })),
    amountBeforeTax: input.document.amountBeforeTax,
    taxAmount: input.document.taxAmount,
    amountAfterTax: input.document.amountAfterTax,
    notes: input.document.notes || '',
  }
}
