import type { UserRole } from './types'

/** Spec roles (Owner / Admin / Member). Legacy boss→Owner, employee→Member. */
export type SpecRole = 'owner' | 'admin' | 'member'

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
  QUOTE_PUBLISH: 'quote.publish',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_INBOUND: 'inventory.inbound',
  INVENTORY_ADJUST: 'inventory.adjust',
  NOTICE_OWN: 'notice.own',
  TEAM_SUMMARY: 'team.summary',
  SENSITIVE_FINANCE: 'sensitive.finance',
  SENSITIVE_PAYROLL_OTHERS: 'sensitive.payroll_others',
  SENSITIVE_MARGIN: 'sensitive.margin',
  PROFILE_PRIVILEGE_EDIT: 'profile.privilege_edit',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Deny-by-default matrices. Admin gets Member + ops, not sensitive by default. */
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
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_INBOUND,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.NOTICE_OWN,
    PERMISSIONS.TEAM_SUMMARY,
    PERMISSIONS.SENSITIVE_FINANCE,
    PERMISSIONS.SENSITIVE_PAYROLL_OTHERS,
    PERMISSIONS.SENSITIVE_MARGIN,
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
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_INBOUND,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.NOTICE_OWN,
    PERMISSIONS.TEAM_SUMMARY,
  ],
  member: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.SITE_READ,
    PERMISSIONS.SITE_WRITE,
    PERMISSIONS.ATTENDANCE_OWN,
    PERMISSIONS.ATTENDANCE_TEAM_SUMMARY,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.QUOTE_CREATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_INBOUND,
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

  if (permission === PERMISSIONS.SENSITIVE_FINANCE) {
    return Boolean(opts?.financeAuthorized) || granted.includes(permission)
  }
  if (permission === PERMISSIONS.SENSITIVE_PAYROLL_OTHERS) {
    return Boolean(opts?.payrollAuthorized) || granted.includes(permission)
  }
  if (permission === PERMISSIONS.SENSITIVE_MARGIN) {
    return Boolean(opts?.financeAuthorized) || granted.includes(permission)
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
