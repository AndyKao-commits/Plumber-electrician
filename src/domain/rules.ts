import type { PurchaseRuleSnapshot, UserRole } from './types'

/** Confirmed product rules from planning conversations. */
export const PRODUCT = {
  name: '工程管家',
  tagline: '水電工程行管理系統',
  sourceConversations: [
    'https://chatgpt.com/share/6af27b2e-31d8-83ee-9de3-c8287529caeb',
    'https://chatgpt.com/share/6af28019-cfd0-83ec-bf49-738de06277ea',
  ],
} as const

/**
 * Roles remain labels, but general job operations are equal for all members.
 * Sensitive finance / other people's payroll / personal privacy need extra auth.
 */
export const ROLES: Record<
  UserRole,
  { label: string; defaultFinanceAuth: boolean }
> = {
  boss: { label: '老闆', defaultFinanceAuth: true },
  employee: { label: '員工', defaultFinanceAuth: false },
}

/** POL-001 + 一般採購門檻：最終應付金額（折扣後含稅運） */
export const PURCHASE_PREAPPROVAL_THRESHOLD_NTD = 3000

/** 緊急採購單次上限 */
export const EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD = 5000

/** POL-002：緊急採購每人每日累計上限（Asia/Taipei） */
export const EMERGENCY_PURCHASE_DAILY_LIMIT_NTD = 10_000

export const DEFAULT_PURCHASE_RULES: PurchaseRuleSnapshot = {
  preApprovalThresholdNtd: PURCHASE_PREAPPROVAL_THRESHOLD_NTD,
  emergencySingleLimitNtd: EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD,
  emergencyDailyLimitNtd: EMERGENCY_PURCHASE_DAILY_LIMIT_NTD,
}

export const FEATURE_FLAGS = {
  offlineFirst: true,
  gpsOptionalOnClockIn: true,
  autoDeductBreak: false,
  payrollMonthly: true,
  simpleInventory: true,
  hybridInventory: true,
  lineOfficialAccount: true,
  lineGroupConfirmBeforeArchive: true,
  /** 全面停用系統主動 LINE 推播 */
  lineProactivePush: false,
  inAppNotificationsOnly: true,
  equalProjectPermissions: true,
  overnightShiftsAllowed: true,
  emailPasswordLoginPrimary: true,
  lineAsEntryOnly: true,
  movingAverageInventoryCost: true,
  quoteTaxChosenPerDocument: true,
} as const

export const BACKUP_TARGETS = {
  rpoHours: 1,
  rtoHours: 4,
} as const

export const HOME_SHORTCUTS = [
  { id: 'clock', label: '出勤打卡', path: '/attendance' },
  { id: 'sites', label: '工地列表', path: '/sites' },
  { id: 'purchase', label: '材料採購', path: '/purchases' },
  { id: 'todos', label: '待辦', path: '/todos' },
  { id: 'team', label: '今日團隊', path: '/team' },
  { id: 'notices', label: '通知中心', path: '/notifications' },
] as const

export type FinalPayableInput = {
  goodsAmount: number
  discount?: number
  tax?: number
  shipping?: number
  otherBuyerFees?: number
}

/** 最終應付金額 = 商品 - 折扣 + 稅 + 運費 + 其他應由買方負擔費用 */
export function calcFinalPayable(input: FinalPayableInput): number {
  const discount = input.discount ?? 0
  const tax = input.tax ?? 0
  const shipping = input.shipping ?? 0
  const other = input.otherBuyerFees ?? 0
  return Math.round((input.goodsAmount - discount + tax + shipping + other) * 100) / 100
}

export function requiresPreApproval(finalPayableNtd: number): boolean {
  return finalPayableNtd >= PURCHASE_PREAPPROVAL_THRESHOLD_NTD
}

export function isWithinEmergencySingleLimit(finalPayableNtd: number): boolean {
  return finalPayableNtd <= EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD
}

export function isWithinEmergencyDailyLimit(
  usedTodayNtd: number,
  nextFinalPayableNtd: number,
): boolean {
  return usedTodayNtd + nextFinalPayableNtd <= EMERGENCY_PURCHASE_DAILY_LIMIT_NTD
}

export function canViewSensitiveFinance(role: UserRole, financeAuthorized = false): boolean {
  return financeAuthorized || ROLES[role].defaultFinanceAuth
}

export function canViewOthersPayroll(role: UserRole, payrollAuthorized = false): boolean {
  return payrollAuthorized || role === 'boss'
}

/** Moving weighted average unit cost. */
export function movingAverageUnitCost(
  oldQty: number,
  oldUnitCost: number,
  inboundQty: number,
  inboundUnitCost: number,
): number {
  const totalQty = oldQty + inboundQty
  if (totalQty <= 0) return inboundUnitCost
  return (oldQty * oldUnitCost + inboundQty * inboundUnitCost) / totalQty
}
