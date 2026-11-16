/** Salary module domain helpers. */

import { workDaysFromEntries } from '@/domain/salaryDailyWage'
import type {
  PayType,
  SalaryEntry,
  SalaryEntryCategory,
  SalaryEntryStatus,
  SalaryMonthSummary,
  SalaryPayment,
} from './types'

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  monthly: '月薪',
  daily: '日薪',
  hourly: '時薪',
}

export const SALARY_CATEGORY_LABELS: Record<SalaryEntryCategory, string> = {
  base: '基本薪資／出勤',
  overtime: '加班費',
  sales_bonus: '銷售獎勵',
  case_bonus: '案件分紅',
  other_bonus: '其他獎勵',
  deduction: '扣款',
  adjustment: '薪資調整',
}

export const SALARY_STATUS_LABELS: Record<SalaryEntryStatus, string> = {
  draft: '草稿',
  pending: '待確認',
  confirmed: '已確認',
  paid: '已支付',
  cancelled: '已取消',
}

export const SALARY_CATEGORIES: SalaryEntryCategory[] = [
  'base',
  'overtime',
  'sales_bonus',
  'case_bonus',
  'other_bonus',
  'deduction',
  'adjustment',
]

export function assertPayType(value: string): PayType {
  if (value === 'monthly' || value === 'daily' || value === 'hourly') return value
  throw new Error('薪資方式僅能為月薪、日薪或時薪')
}

export function assertSalaryCategory(value: string): SalaryEntryCategory {
  if ((SALARY_CATEGORIES as string[]).includes(value)) {
    return value as SalaryEntryCategory
  }
  throw new Error('薪資類別無效')
}

export function assertSalaryAmount(value: number, category: SalaryEntryCategory): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('金額請用整數元')
  }
  if (value === 0) throw new Error('金額不可為 0')
  if (category === 'deduction' && value > 0) {
    return -Math.abs(value)
  }
  if (category !== 'deduction' && category !== 'adjustment' && value < 0) {
    throw new Error('此類別金額需為正數')
  }
  return value
}

export function assertBossSalaryAction(
  roleOrUser: string | { role: string; accessTemplate?: string | null },
) {
  const role =
    typeof roleOrUser === 'string' ? roleOrUser : roleOrUser.role
  const accessTemplate =
    typeof roleOrUser === 'string' ? null : roleOrUser.accessTemplate
  if (
    role === 'boss' ||
    role === 'owner' ||
    accessTemplate === 'owner'
  ) {
    return
  }
  throw new Error('僅老闆可操作薪資管理')
}

export function periodFromDate(isoOrDate: string): { year: number; month: number } {
  const day = isoOrDate.slice(0, 10)
  const [y, m] = day.split('-').map(Number)
  if (!y || !m) throw new Error('日期無效')
  return { year: y, month: m }
}

export function currentTaipeiPeriod(now = new Date()): {
  year: number
  month: number
  label: string
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return { year, month, label: `${year} 年 ${month} 月` }
}

/** Calendar / legend colors by salary category. */
export const SALARY_CATEGORY_COLORS: Record<SalaryEntryCategory, string> = {
  base: '#1f4e79',
  overtime: '#b45309',
  sales_bonus: '#0f766e',
  case_bonus: '#6d28d9',
  other_bonus: '#0369a1',
  deduction: '#b91c1c',
  adjustment: '#475569',
}

export function summarizeSalaryMonth(
  entries: SalaryEntry[],
  payments: SalaryPayment[] = [],
): SalaryMonthSummary {
  let confirmedTotal = 0
  let pendingTotal = 0
  let legacyPaidEntries = 0
  for (const e of entries) {
    if (e.status === 'cancelled' || e.status === 'draft') continue
    if (e.status === 'pending') pendingTotal += e.amount
    if (e.status === 'confirmed') confirmedTotal += e.amount
    if (e.status === 'paid') {
      confirmedTotal += e.amount
      legacyPaidEntries += e.amount
    }
  }
  const paymentSum = payments.reduce((s, p) => s + p.amount, 0)
  const paidTotal = paymentSum > 0 ? paymentSum : legacyPaidEntries
  const unpaidTotal = confirmedTotal - paidTotal
  return {
    confirmedTotal,
    pendingTotal,
    paidTotal,
    unpaidTotal,
    workDays: workDaysFromEntries(entries),
  }
}

/** Cross-month unpaid balance for employee home. */
export function summarizeUnpaidAcrossMonths(
  months: Array<{ year: number; month: number; summary: SalaryMonthSummary }>,
): {
  unpaidTotal: number
  months: Array<{
    year: number
    month: number
    unpaidTotal: number
    confirmedTotal: number
    paidTotal: number
    workDays: number
  }>
} {
  const rows = months
    .map((m) => ({
      year: m.year,
      month: m.month,
      unpaidTotal: m.summary.unpaidTotal,
      confirmedTotal: m.summary.confirmedTotal,
      paidTotal: m.summary.paidTotal,
      workDays: m.summary.workDays,
      pendingTotal: m.summary.pendingTotal,
    }))
    .filter(
      (m) =>
        m.unpaidTotal !== 0 ||
        m.confirmedTotal !== 0 ||
        m.pendingTotal !== 0,
    )
    .sort((a, b) =>
      a.year === b.year ? b.month - a.month : b.year - a.year,
    )
  return {
    unpaidTotal: rows.reduce((s, r) => s + r.unpaidTotal, 0),
    months: rows,
  }
}

export function canConfirmSalaryEntry(status: SalaryEntryStatus): boolean {
  return status === 'draft' || status === 'pending'
}

/** @deprecated Prefer salary_payments; kept for legacy status transitions. */
export function canMarkSalaryPaid(status: SalaryEntryStatus): boolean {
  return status === 'confirmed'
}

export function defaultSettlementPeriod(now = new Date()): {
  year: number
  month: number
} {
  const cur = currentTaipeiPeriod(now)
  if (cur.month === 1) return { year: cur.year - 1, month: 12 }
  return { year: cur.year, month: cur.month - 1 }
}

export function assertCorrectionReason(reason: string): string {
  const r = reason.trim()
  if (r.length < 2) throw new Error('更正請填寫原因')
  if (r.length > 200) throw new Error('更正原因過長')
  return r
}
