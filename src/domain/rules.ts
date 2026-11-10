import type { PurchaseRuleSnapshot, UserRole } from './types'

/** Confirmed product rules from the planning conversation. */
export const PRODUCT = {
  name: '工程管家',
  tagline: '水電工程行管理系統',
  sourceConversation:
    'https://chatgpt.com/share/6af27b2e-31d8-83ee-9de3-c8287529caeb',
} as const

export const ROLES: Record<
  UserRole,
  { label: string; canManageCompany: boolean; canViewOthersPayroll: boolean }
> = {
  boss: {
    label: '老闆',
    canManageCompany: true,
    canViewOthersPayroll: true,
  },
  employee: {
    label: '員工',
    canManageCompany: false,
    canViewOthersPayroll: false,
  },
}

/** 單筆採購達此金額（含）以上需老闆事前核准 */
export const PURCHASE_PREAPPROVAL_THRESHOLD_NTD = 3000

/** 緊急採購預設單次上限 */
export const EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD = 5000

/**
 * 緊急採購每日累計上限尚未在規劃對話中確認。
 * null = 暫不強制；確認後改為實際數字。
 */
export const EMERGENCY_PURCHASE_DAILY_LIMIT_NTD: number | null = null

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
  lineOfficialAccount: true,
  lineGroupConfirmBeforeArchive: true,
} as const

export function requiresPreApproval(amountNtd: number): boolean {
  return amountNtd >= PURCHASE_PREAPPROVAL_THRESHOLD_NTD
}

export function isWithinEmergencySingleLimit(amountNtd: number): boolean {
  return amountNtd <= EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD
}

export function canManageCompany(role: UserRole): boolean {
  return ROLES[role].canManageCompany
}
