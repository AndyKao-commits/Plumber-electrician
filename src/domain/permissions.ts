import type { UserRole } from './types'

/** Spec roles (Owner / Admin / Member). Legacy boss→Owner, employee→Member. */
export type SpecRole = 'owner' | 'admin' | 'member'

/**
 * Permission dictionary — ops vs sensitive finance are separate.
 * Admin may approve purchases and export/mark-accept quotes without finance.*.
 * Member may view/edit drafts; must not export formal versions or mark accept.
 */
export const PERMISSIONS = {
  ORG_READ: 'org.read',
  SITE_READ: 'site.read',
  SITE_WRITE: 'site.write',
  ATTENDANCE_OWN: 'attendance.own',
  ATTENDANCE_TEAM_SUMMARY: 'attendance.team_summary',
  ATTENDANCE_OTHERS_DETAIL: 'attendance.others_detail',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_APPROVE: 'purchase.approve',
  PURCHASE_SELF_APPROVE: 'purchase.self_approve',
  QUOTE_CREATE: 'quote.create',
  /** @deprecated Prefer QUOTE_EXPORT — kept for older checks. */
  QUOTE_PUBLISH: 'quote.publish',
  /** Create immutable export version / PDF / CSV (Owner＋Admin). */
  QUOTE_EXPORT: 'quote.export',
  /** Mark customer accepted / rejected / sent (Owner＋Admin). */
  QUOTE_MARK_ACCEPT: 'quote.mark_accept',
  /** Soft-delete quote cases / versions (Owner＋Admin). */
  QUOTE_DELETE: 'quote.delete',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_INBOUND: 'inventory.inbound',
  /** Stocktake / variance posting — Member allowed by policy; UI in next batch. */
  INVENTORY_ADJUST: 'inventory.adjust',
  NOTICE_OWN: 'notice.own',
  TEAM_SUMMARY: 'team.summary',
  /** Sensitive finance family — NOT implied by Admin purchase/quote ops. */
  FINANCE_READ: 'finance.read',
  FINANCE_COST_READ: 'finance.cost.read',
  FINANCE_WRITE: 'finance.write',
  SENSITIVE_FINANCE: 'sensitive.finance',
  SENSITIVE_PAYROLL_OTHERS: 'sensitive.payroll_others',
  SENSITIVE_MARGIN: 'sensitive.margin',
  SENSITIVE_BANK: 'sensitive.bank',
  SENSITIVE_ACCESS_CONTROL: 'sensitive.access_control',
  PROFILE_PRIVILEGE_EDIT: 'profile.privilege_edit',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const SENSITIVE_FINANCE_FAMILY: readonly PermissionCode[] = [
  PERMISSIONS.FINANCE_READ,
  PERMISSIONS.FINANCE_COST_READ,
  PERMISSIONS.FINANCE_WRITE,
  PERMISSIONS.SENSITIVE_FINANCE,
  PERMISSIONS.SENSITIVE_MARGIN,
  PERMISSIONS.SENSITIVE_BANK,
]

/** Deny-by-default. Admin = ops without sensitive finance. */
const ROLE_PERMISSIONS: Record<SpecRole, readonly PermissionCode[]> = {
  owner: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.SITE_READ,
    PERMISSIONS.SITE_WRITE,
    PERMISSIONS.ATTENDANCE_OWN,
    PERMISSIONS.ATTENDANCE_TEAM_SUMMARY,
    PERMISSIONS.ATTENDANCE_OTHERS_DETAIL,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PURCHASE_APPROVE,
    PERMISSIONS.QUOTE_CREATE,
    PERMISSIONS.QUOTE_PUBLISH,
    PERMISSIONS.QUOTE_EXPORT,
    PERMISSIONS.QUOTE_MARK_ACCEPT,
    PERMISSIONS.QUOTE_DELETE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_INBOUND,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.NOTICE_OWN,
    PERMISSIONS.TEAM_SUMMARY,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_COST_READ,
    PERMISSIONS.FINANCE_WRITE,
    PERMISSIONS.SENSITIVE_FINANCE,
    PERMISSIONS.SENSITIVE_PAYROLL_OTHERS,
    PERMISSIONS.SENSITIVE_MARGIN,
    PERMISSIONS.SENSITIVE_BANK,
    PERMISSIONS.SENSITIVE_ACCESS_CONTROL,
    PERMISSIONS.PROFILE_PRIVILEGE_EDIT,
  ],
  admin: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.SITE_READ,
    PERMISSIONS.SITE_WRITE,
    PERMISSIONS.ATTENDANCE_OWN,
    PERMISSIONS.ATTENDANCE_TEAM_SUMMARY,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PURCHASE_APPROVE,
    PERMISSIONS.QUOTE_CREATE,
    PERMISSIONS.QUOTE_PUBLISH,
    PERMISSIONS.QUOTE_EXPORT,
    PERMISSIONS.QUOTE_MARK_ACCEPT,
    PERMISSIONS.QUOTE_DELETE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_INBOUND,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.NOTICE_OWN,
    PERMISSIONS.TEAM_SUMMARY,
    // Explicitly NO finance.read / finance.cost.read / finance.write /
    // sensitive.finance / margin / payroll / bank / access_control
  ],
  member: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.SITE_READ,
    PERMISSIONS.SITE_WRITE,
    PERMISSIONS.ATTENDANCE_OWN,
    PERMISSIONS.ATTENDANCE_TEAM_SUMMARY,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.QUOTE_CREATE,
    // NO QUOTE_EXPORT / QUOTE_MARK_ACCEPT / QUOTE_DELETE
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_INBOUND,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.NOTICE_OWN,
    PERMISSIONS.TEAM_SUMMARY,
  ],
}

/** Explicit denies always win (REV-07 safe defaults). */
const ALWAYS_DENIED: readonly PermissionCode[] = [
  PERMISSIONS.PURCHASE_SELF_APPROVE,
]

export function mapLegacyRoleToSpec(role: UserRole | SpecRole | string): SpecRole {
  if (role === 'boss' || role === 'owner') return 'owner'
  if (role === 'admin') return 'admin'
  return 'member'
}

export function hasPermission(
  role: UserRole | SpecRole | string,
  permission: PermissionCode,
  opts?: { financeAuthorized?: boolean; payrollAuthorized?: boolean },
): boolean {
  if (ALWAYS_DENIED.includes(permission)) return false

  const spec = mapLegacyRoleToSpec(role)
  const granted = ROLE_PERMISSIONS[spec]

  if (SENSITIVE_FINANCE_FAMILY.includes(permission)) {
    return Boolean(opts?.financeAuthorized) || granted.includes(permission)
  }
  if (permission === PERMISSIONS.SENSITIVE_PAYROLL_OTHERS) {
    return Boolean(opts?.payrollAuthorized) || granted.includes(permission)
  }
  if (permission === PERMISSIONS.SENSITIVE_ACCESS_CONTROL) {
    return granted.includes(permission)
  }

  return granted.includes(permission)
}

export function assertPermission(
  role: UserRole | SpecRole | string,
  permission: PermissionCode,
  opts?: { financeAuthorized?: boolean; payrollAuthorized?: boolean },
): void {
  if (!hasPermission(role, permission, opts)) {
    throw new Error('無權執行此操作')
  }
}

export function assertCanPublishQuote(
  role: UserRole | SpecRole | string,
): void {
  assertCanExportQuote(role)
}

export function assertCanExportQuote(
  role: UserRole | SpecRole | string,
): void {
  if (
    !hasPermission(role, PERMISSIONS.QUOTE_EXPORT) &&
    !hasPermission(role, PERMISSIONS.QUOTE_PUBLISH)
  ) {
    throw new Error('無權匯出正式報價版本（僅老闆／管理員）')
  }
}

export function assertCanMarkQuoteAccept(
  role: UserRole | SpecRole | string,
): void {
  if (!hasPermission(role, PERMISSIONS.QUOTE_MARK_ACCEPT)) {
    throw new Error('無權標記客戶接受狀態（僅老闆／管理員）')
  }
}

/** Admin/Member without finance grant must not read cost/margin/payroll/bank/ACL. */
export function assertCanViewSensitiveFinance(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): void {
  if (!canViewSensitiveFinance(role, financeAuthorized)) {
    throw new Error('無權查看敏感財務資料')
  }
}

export function assertCanViewCost(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): void {
  if (!hasPermission(role, PERMISSIONS.FINANCE_COST_READ, { financeAuthorized })) {
    throw new Error('無權查看成本資料')
  }
}

export function assertCanManageAccess(
  role: UserRole | SpecRole | string,
): void {
  if (!hasPermission(role, PERMISSIONS.SENSITIVE_ACCESS_CONTROL)) {
    throw new Error('無權管理存取權限')
  }
}

export function canViewSensitiveFinance(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): boolean {
  return hasPermission(role, PERMISSIONS.SENSITIVE_FINANCE, { financeAuthorized })
}

export function canViewOthersPayroll(
  role: UserRole | SpecRole | string,
  payrollAuthorized = false,
): boolean {
  return hasPermission(role, PERMISSIONS.SENSITIVE_PAYROLL_OTHERS, {
    payrollAuthorized,
  })
}

export function canApprovePurchase(input: {
  actorRole: UserRole | SpecRole | string
  actorId: string
  requesterId: string
}): boolean {
  if (input.actorId === input.requesterId) return false
  return hasPermission(input.actorRole, PERMISSIONS.PURCHASE_APPROVE)
}

export function assertCanApprovePurchase(input: {
  actorRole: UserRole | SpecRole | string
  actorId: string
  requesterId: string
}): void {
  if (input.actorId === input.requesterId) {
    throw new Error('禁止申請人自行核准自己的採購（REV-07）')
  }
  if (!hasPermission(input.actorRole, PERMISSIONS.PURCHASE_APPROVE)) {
    throw new Error('無權核准此採購')
  }
}

export function assertSameOrganization(
  actorOrgId: string | null | undefined,
  resourceOrgId: string | null | undefined,
): void {
  if (!actorOrgId || !resourceOrgId || actorOrgId !== resourceOrgId) {
    throw new Error('不得存取其他組織資料')
  }
}

/** Admin ops vs finance separation helpers for UI/API checks. */
export function adminCanApproveWithoutFinance(role: UserRole | SpecRole | string): boolean {
  return (
    hasPermission(role, PERMISSIONS.PURCHASE_APPROVE) &&
    !hasPermission(role, PERMISSIONS.FINANCE_READ) &&
    mapLegacyRoleToSpec(role) === 'admin'
  )
}
