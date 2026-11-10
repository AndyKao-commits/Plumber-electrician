import { roundMoney } from './money'
import { hasPermission, PERMISSIONS, type SpecRole } from './permissions'
import type {
  ChangeOrder,
  ChangeOrderItem,
  ChangeOrderKind,
  ChangeOrderStatus,
  Quotation,
  QuotationItem,
  TaxMode,
  UserRole,
} from './types'
import { calcQuoteTotals } from './quoteWorkflow'

export const CHANGE_ORDER_KIND_LABELS: Record<ChangeOrderKind, string> = {
  addition: '追加',
  reduction: '追減',
}

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  draft: '草稿',
  sent_to_customer: '已提供客戶',
  accepted: '客戶已接受',
  rejected: '客戶未接受',
  cancelled: '已取消',
}

export function isChangeOrderEditable(
  status: ChangeOrderStatus | string | undefined,
): boolean {
  return status === 'draft' || status === 'sent_to_customer' || status === 'rejected'
}

export function assertChangeOrderEditable(input: {
  status?: string
}): void {
  if (!isChangeOrderEditable(input.status)) {
    throw new Error('此追加減狀態不可修改（已接受或已取消）')
  }
}

export function canCreateChangeOrder(
  role: UserRole | SpecRole | string,
  quote: Pick<Quotation, 'workflowStatus' | 'deletedAt'>,
): { ok: true } | { ok: false; reason: string } {
  if (!hasPermission(role, PERMISSIONS.QUOTE_CREATE)) {
    return { ok: false, reason: '無權建立追加減' }
  }
  if (quote.deletedAt) {
    return { ok: false, reason: '報價案件已刪除' }
  }
  if (quote.workflowStatus !== 'accepted') {
    return {
      ok: false,
      reason: '僅「客戶已接受」的報價可建立追加減',
    }
  }
  return { ok: true }
}

export function canMarkChangeOrderAccept(
  role: UserRole | SpecRole | string,
): boolean {
  return hasPermission(role, PERMISSIONS.QUOTE_MARK_ACCEPT)
}

export function assertCanMarkChangeOrderAccept(
  role: UserRole | SpecRole | string,
): void {
  if (!canMarkChangeOrderAccept(role)) {
    throw new Error('無權標記追加減接受狀態（僅老闆／管理員）')
  }
}

/**
 * 有效合約＝已接受報價＋已接受追加－已接受追減（FIN-002 / FIN-04）。
 * 未接受追加減不計入。
 */
export function effectiveContractAmountWithChangeOrders(input: {
  quotes: Array<Pick<Quotation, 'workflowStatus' | 'amountAfterTax'>>
  changeOrders?: Array<
    Pick<ChangeOrder, 'status' | 'kind' | 'amountAfterTax'>
  >
}): number {
  let total = 0
  for (const q of input.quotes) {
    if (q.workflowStatus !== 'accepted') continue
    total = roundMoney(total + (Number(q.amountAfterTax) || 0))
  }
  for (const co of input.changeOrders ?? []) {
    if (co.status !== 'accepted') continue
    const amt = Number(co.amountAfterTax) || 0
    if (co.kind === 'addition') {
      total = roundMoney(total + amt)
    } else {
      total = roundMoney(total - amt)
    }
  }
  return total
}

export function signedChangeOrderAmount(
  co: Pick<ChangeOrder, 'kind' | 'amountAfterTax' | 'status'>,
): number {
  if (co.status !== 'accepted') return 0
  const amt = Number(co.amountAfterTax) || 0
  return co.kind === 'addition' ? amt : -amt
}

export function calcChangeOrderTotals(input: {
  items: Array<Pick<ChangeOrderItem, 'amount' | 'kind'>>
  discount?: number
  taxMode: TaxMode
  taxRate?: number
}) {
  return calcQuoteTotals({
    items: input.items as Array<Pick<QuotationItem, 'amount' | 'kind'>>,
    discount: input.discount,
    taxMode: input.taxMode,
    taxRate: input.taxRate,
  })
}
