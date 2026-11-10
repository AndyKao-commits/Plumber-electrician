import type { Quotation, QuotationVersion, QuoteWorkflowStatus } from './types'
import { hasPermission, PERMISSIONS, type SpecRole } from './permissions'
import type { UserRole } from './types'

export function canSoftDeleteQuoteCase(
  role: UserRole | SpecRole | string,
  quote: Pick<Quotation, 'workflowStatus' | 'deletedAt'>,
): { ok: true } | { ok: false; reason: string } {
  if (!hasPermission(role, PERMISSIONS.QUOTE_DELETE)) {
    return { ok: false, reason: '無權刪除報價案件（僅老闆／管理員）' }
  }
  if (quote.deletedAt) {
    return { ok: false, reason: '此案件已刪除' }
  }
  if (quote.workflowStatus === 'accepted') {
    return {
      ok: false,
      reason: '客戶已接受的案件已計入有效合約，不可直接刪除',
    }
  }
  return { ok: true }
}

export function canSoftDeleteQuoteVersion(
  role: UserRole | SpecRole | string,
  quote: Pick<Quotation, 'workflowStatus'>,
  version: Pick<QuotationVersion, 'deletedAt' | 'versionNo'>,
): { ok: true } | { ok: false; reason: string } {
  if (!hasPermission(role, PERMISSIONS.QUOTE_DELETE)) {
    return { ok: false, reason: '無權刪除歷史版本（僅老闆／管理員）' }
  }
  if (version.deletedAt) {
    return { ok: false, reason: '此版本已刪除' }
  }
  const locked: QuoteWorkflowStatus[] = ['sent_to_customer', 'accepted']
  if (locked.includes(quote.workflowStatus as QuoteWorkflowStatus)) {
    return {
      ok: false,
      reason: '已提供客戶或客戶已接受的案件，歷史版本不可刪除',
    }
  }
  return { ok: true }
}

export function assertCanSoftDeleteQuoteCase(
  role: UserRole | SpecRole | string,
  quote: Pick<Quotation, 'workflowStatus' | 'deletedAt'>,
): void {
  const r = canSoftDeleteQuoteCase(role, quote)
  if (!r.ok) throw new Error(r.reason)
}

export function assertCanSoftDeleteQuoteVersion(
  role: UserRole | SpecRole | string,
  quote: Pick<Quotation, 'workflowStatus'>,
  version: Pick<QuotationVersion, 'deletedAt' | 'versionNo'>,
): void {
  const r = canSoftDeleteQuoteVersion(role, quote, version)
  if (!r.ok) throw new Error(r.reason)
}
