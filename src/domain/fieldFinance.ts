/**
 * V1.0 field finance: employee expense / cash-receipt reports.
 * Only confirmed amounts enter case stats. Employees cannot self-finalize.
 */
import { roundMoney } from './money'
import type { UserRole } from './types'

export type ExpenseReportStatus =
  | 'pending_review'
  | 'confirmed'
  | 'returned'
  | 'cancelled'

export type CashReceiptStatus =
  | 'pending_confirm'
  | 'confirmed'
  | 'returned'
  | 'cancelled'

export const EXPENSE_STATUS_LABELS: Record<ExpenseReportStatus, string> = {
  pending_review: '待審核',
  confirmed: '已確認',
  returned: '退回修改',
  cancelled: '已取消',
}

export const RECEIPT_STATUS_LABELS: Record<CashReceiptStatus, string> = {
  pending_confirm: '待確認',
  confirmed: '已確認',
  returned: '退回修改',
  cancelled: '已取消',
}

export function assertPositiveMoney(amount: number, label = '金額'): number {
  const a = roundMoney(Number(amount))
  if (!Number.isFinite(a) || a <= 0) throw new Error(`${label}必須大於 0`)
  return a
}

export function assertExpenseItem(item: string): string {
  const s = item.trim()
  if (!s) throw new Error('請填寫支出項目')
  return s
}

/** Sentinel used by UI selects for misc (no site) cash. */
export const MISC_SITE_VALUE = '__misc__'

export const MISC_SITE_LABEL = '雜項（無工地）'

/** Examples: 加油、買飯、飲料、臨時支援 */
export const MISC_EXPENSE_EXAMPLES = ['加油', '買飯', '飲料', '臨時支援'] as const

export function resolveFieldCashTarget(input: {
  siteId?: string | null
  siteName?: string | null
  locationText?: string | null
  misc?: boolean
}): {
  siteId: string | null
  siteName: string
  locationText: string | null
  isMisc: boolean
} {
  const misc =
    input.misc === true ||
    input.siteId === MISC_SITE_VALUE ||
    (!input.siteId && Boolean(input.locationText?.trim() || input.siteName === MISC_SITE_LABEL))
  if (misc) {
    const location = input.locationText?.trim() || null
    return {
      siteId: null,
      siteName: MISC_SITE_LABEL,
      locationText: location,
      isMisc: true,
    }
  }
  const siteId = (input.siteId || '').trim()
  if (!siteId) {
    throw new Error('請選擇工地，或改選雜項並自行輸入地點')
  }
  return {
    siteId,
    siteName: (input.siteName || '').trim() || '工地',
    locationText: input.locationText?.trim() || null,
    isMisc: false,
  }
}

/** Case-linked totals should ignore misc (null site) rows. */
export function isCaseLinkedCash(row: { siteId?: string | null }): boolean {
  return Boolean(row.siteId)
}

/** Employees cannot finalize their own expense / receipt. */
export function assertBossFinalize(input: {
  actorRole: UserRole
  actorId: string
  reporterId: string
}): void {
  if (input.actorRole !== 'boss') {
    throw new Error('僅老闆可最終審核／確認')
  }
  if (input.actorId === input.reporterId) {
    throw new Error('不可最終審核自己回報的支出／收款')
  }
}

export function assertCanReviewExpense(status: ExpenseReportStatus): void {
  if (status !== 'pending_review' && status !== 'returned') {
    throw new Error('僅待審核／退回件可再審核')
  }
}

export function assertCanConfirmReceipt(status: CashReceiptStatus): void {
  if (status !== 'pending_confirm' && status !== 'returned') {
    throw new Error('僅待確認／退回件可再確認')
  }
}

/** Boss may cancel mistaken entries, including already-confirmed ones. */
export function assertBossCancelFinance(actorRole: UserRole): void {
  if (actorRole !== 'boss') {
    throw new Error('僅老闆可刪除／取消收支紀錄')
  }
}

export function assertCanCancelExpense(status: ExpenseReportStatus): void {
  if (status === 'cancelled') {
    throw new Error('此支出已取消')
  }
}

export function assertCanCancelReceipt(status: CashReceiptStatus): void {
  if (status === 'cancelled') {
    throw new Error('此收款已取消')
  }
}

/**
 * Case balance (V1.0):
 * 有效合約 − 已確認支出 = 案件目前餘額
 * Receipts are tracked separately for cash visibility (not mixed into this formula).
 */
export function computeCaseFinance(input: {
  acceptedContractAmount: number
  confirmedExpenseTotal: number
  pendingExpenseTotal: number
  confirmedReceiptTotal: number
  pendingReceiptTotal: number
}): {
  acceptedContractAmount: number
  confirmedExpenseTotal: number
  pendingExpenseTotal: number
  confirmedReceiptTotal: number
  pendingReceiptTotal: number
  caseBalance: number
} {
  const accepted = roundMoney(Number(input.acceptedContractAmount) || 0)
  const confExp = roundMoney(Number(input.confirmedExpenseTotal) || 0)
  return {
    acceptedContractAmount: accepted,
    confirmedExpenseTotal: confExp,
    pendingExpenseTotal: roundMoney(Number(input.pendingExpenseTotal) || 0),
    confirmedReceiptTotal: roundMoney(Number(input.confirmedReceiptTotal) || 0),
    pendingReceiptTotal: roundMoney(Number(input.pendingReceiptTotal) || 0),
    caseBalance: roundMoney(accepted - confExp),
  }
}

/** Next site sequence no. for a site (confirmed rows keep numbers; gaps OK). */
export function nextSiteReceiptSequence(
  receipts: Array<{
    siteId?: string | null
    status: CashReceiptStatus
    siteSequenceNo?: number | null
  }>,
  siteId: string | null | undefined,
): number | null {
  if (!siteId) return null
  let max = 0
  for (const r of receipts) {
    if (r.siteId !== siteId) continue
    const n = Number(r.siteSequenceNo)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

/**
 * Site cash progress: sequence is site-scoped; contract/remaining only when
 * accepted quotes exist for the site (quote optional at report time).
 */
export function computeSiteReceiptProgress(input: {
  siteId: string
  receipts: Array<{
    siteId?: string | null
    status: CashReceiptStatus
    amount: number
    siteSequenceNo?: number | null
    receivedOn?: string | null
    reportedAt?: string
  }>
  /** Accepted contract total for this site (0 = no quote yet). */
  contractAmount: number
}): {
  confirmedTotal: number
  pendingTotal: number
  confirmedCount: number
  nextSequence: number
  contractAmount: number
  remaining: number | null
  progressPct: number | null
  overReceived: boolean
} {
  const siteRows = input.receipts.filter((r) => r.siteId === input.siteId)
  let confirmedTotal = 0
  let pendingTotal = 0
  let confirmedCount = 0
  for (const r of siteRows) {
    if (r.status === 'confirmed') {
      confirmedTotal = roundMoney(confirmedTotal + (Number(r.amount) || 0))
      confirmedCount += 1
    } else if (r.status === 'pending_confirm') {
      pendingTotal = roundMoney(pendingTotal + (Number(r.amount) || 0))
    }
  }
  const contract = roundMoney(Number(input.contractAmount) || 0)
  const hasContract = contract > 0
  const remaining = hasContract ? roundMoney(contract - confirmedTotal) : null
  const progressPct = hasContract
    ? Math.round((confirmedTotal / contract) * 1000) / 10
    : null
  return {
    confirmedTotal,
    pendingTotal,
    confirmedCount,
    nextSequence: nextSiteReceiptSequence(siteRows, input.siteId) ?? 1,
    contractAmount: contract,
    remaining,
    progressPct,
    overReceived: hasContract && confirmedTotal > contract,
  }
}

/** Warn (do not block) when confirming would exceed contract. */
export function receiptConfirmOverContractWarning(input: {
  contractAmount: number
  alreadyConfirmedTotal: number
  confirmingAmount: number
}): string | null {
  const contract = roundMoney(Number(input.contractAmount) || 0)
  if (contract <= 0) return null
  const next = roundMoney(
    (Number(input.alreadyConfirmedTotal) || 0) +
      (Number(input.confirmingAmount) || 0),
  )
  if (next <= contract) return null
  const over = roundMoney(next - contract)
  return `確認後累計收款 NT$${next.toLocaleString()} 將超過合約 NT$${contract.toLocaleString()}（超收 NT$${over.toLocaleString()}）。仍可確認。`
}

/** Accepted quotes for a site → auto-pick when exactly one. */
export function pickAutoQuoteId(
  quotes: Array<{
    id: string
    projectId?: string | null
    workflowStatus?: string
    deletedAt?: string | null
  }>,
  siteId: string | null | undefined,
): string | null {
  if (!siteId) return null
  const matches = quotes.filter(
    (q) =>
      q.projectId === siteId &&
      q.workflowStatus === 'accepted' &&
      !q.deletedAt,
  )
  return matches.length === 1 ? matches[0].id : null
}

export function sumAcceptedContractForSite(
  quotes: Array<{
    projectId?: string | null
    workflowStatus?: string
    deletedAt?: string | null
    amountAfterTax?: number
  }>,
  siteId: string,
): number {
  let total = 0
  for (const q of quotes) {
    if (q.projectId !== siteId) continue
    if (q.workflowStatus !== 'accepted' || q.deletedAt) continue
    total = roundMoney(total + (Number(q.amountAfterTax) || 0))
  }
  return total
}

export type LedgerEntryKind = 'expense' | 'receipt'

export type LedgerEntry = {
  id: string
  kind: LedgerEntryKind
  /** YYYY-MM-DD for month filter */
  date: string
  siteId: string | null
  siteName: string
  item: string
  amount: number
  status: string
  statusLabel: string
  reportedByName: string
  note?: string | null
  sequenceLabel?: string | null
  quotationId?: string | null
  hasProof: boolean
  reportedAt: string
}

export function buildCashLedger(input: {
  expenses: Array<{
    id: string
    siteId: string | null
    siteName: string
    locationText?: string | null
    item: string
    amount: number
    note?: string | null
    receiptPhotoPath?: string | null
    status: ExpenseReportStatus
    reportedByName: string
    reportedAt: string
  }>
  receipts: Array<{
    id: string
    siteId: string | null
    siteName: string
    locationText?: string | null
    quotationId?: string | null
    receivedOn?: string | null
    siteSequenceNo?: number | null
    amount: number
    sourceNote?: string | null
    proofPhotoPath?: string | null
    status: CashReceiptStatus
    reportedByName: string
    reportedAt: string
  }>
  expenseDate?: (iso: string) => string
}): LedgerEntry[] {
  const toDate =
    input.expenseDate ||
    ((iso: string) => {
      const d = String(iso || '').slice(0, 10)
      return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : d
    })
  const rows: LedgerEntry[] = []
  for (const e of input.expenses) {
    rows.push({
      id: `exp:${e.id}`,
      kind: 'expense',
      date: toDate(e.reportedAt),
      siteId: e.siteId,
      siteName: e.locationText
        ? `${e.siteName}（${e.locationText}）`
        : e.siteName,
      item: e.item,
      amount: e.amount,
      status: e.status,
      statusLabel: EXPENSE_STATUS_LABELS[e.status],
      reportedByName: e.reportedByName,
      note: e.note,
      hasProof: Boolean(e.receiptPhotoPath),
      reportedAt: e.reportedAt,
    })
  }
  for (const r of input.receipts) {
    const date =
      (r.receivedOn && /^\d{4}-\d{2}-\d{2}$/.test(r.receivedOn)
        ? r.receivedOn
        : toDate(r.reportedAt)) || toDate(r.reportedAt)
    rows.push({
      id: `rc:${r.id}`,
      kind: 'receipt',
      date,
      siteId: r.siteId,
      siteName: r.locationText
        ? `${r.siteName}（${r.locationText}）`
        : r.siteName,
      item: r.sourceNote?.trim() || '收款',
      amount: r.amount,
      status: r.status,
      statusLabel: RECEIPT_STATUS_LABELS[r.status],
      reportedByName: r.reportedByName,
      note: r.sourceNote,
      sequenceLabel:
        r.siteSequenceNo != null ? `第 ${r.siteSequenceNo} 次` : null,
      quotationId: r.quotationId ?? null,
      hasProof: Boolean(r.proofPhotoPath),
      reportedAt: r.reportedAt,
    })
  }
  return rows.sort((a, b) => {
    const d = b.date.localeCompare(a.date)
    if (d !== 0) return d
    return b.reportedAt.localeCompare(a.reportedAt)
  })
}

export function filterCashLedger(
  rows: LedgerEntry[],
  filter: {
    /** YYYY-MM */
    month?: string | null
    kind?: LedgerEntryKind | 'all'
    status?: string | 'all'
    siteId?: string | 'all' | null
  },
): LedgerEntry[] {
  return rows.filter((r) => {
    if (filter.month && !r.date.startsWith(filter.month)) return false
    if (filter.kind && filter.kind !== 'all' && r.kind !== filter.kind) {
      return false
    }
    if (filter.status && filter.status !== 'all' && r.status !== filter.status) {
      return false
    }
    if (
      filter.siteId &&
      filter.siteId !== 'all' &&
      (r.siteId || '') !== filter.siteId
    ) {
      return false
    }
    return true
  })
}

export function summarizeLedger(rows: LedgerEntry[]): {
  expenseTotal: number
  receiptTotal: number
  net: number
  count: number
} {
  let expenseTotal = 0
  let receiptTotal = 0
  for (const r of rows) {
    if (r.kind === 'expense') {
      expenseTotal = roundMoney(expenseTotal + r.amount)
    } else {
      receiptTotal = roundMoney(receiptTotal + r.amount)
    }
  }
  return {
    expenseTotal,
    receiptTotal,
    net: roundMoney(receiptTotal - expenseTotal),
    count: rows.length,
  }
}
