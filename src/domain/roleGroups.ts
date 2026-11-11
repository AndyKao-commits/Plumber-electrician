import type { SpecRole } from '@/domain/permissions'

/** Named identity group the boss can assign to teammates. */
export type RoleGroupTemplate = SpecRole | 'finance'

export interface RoleGroupDefinition {
  id: string
  name: string
  /** Maps onto SpecRole; finance = member + financeAuthorized */
  template: RoleGroupTemplate
  financeAuthorized: boolean
  builtIn?: boolean
}

export const BUILTIN_ROLE_GROUPS: RoleGroupDefinition[] = [
  {
    id: 'grp-owner',
    name: '老闆／管理者',
    template: 'owner',
    financeAuthorized: true,
    builtIn: true,
  },
  {
    id: 'grp-admin',
    name: '管理員',
    template: 'admin',
    financeAuthorized: false,
    builtIn: true,
  },
  {
    id: 'grp-member',
    name: '師傅',
    template: 'member',
    financeAuthorized: false,
    builtIn: true,
  },
  {
    id: 'grp-finance',
    name: '財務',
    template: 'finance',
    financeAuthorized: true,
    builtIn: true,
  },
]

export const ROLE_GROUP_TEMPLATE_LABELS: Record<RoleGroupTemplate, string> = {
  owner: '老闆（全部權限）',
  admin: '管理員（營運核准，不含敏感財務）',
  member: '師傅（現場作業）',
  finance: '財務（敏感財務授權）',
}

export function templateToAccessFields(template: RoleGroupTemplate): {
  accessTemplate: SpecRole
  financeAuthorized: boolean
} {
  if (template === 'finance') {
    return { accessTemplate: 'member', financeAuthorized: true }
  }
  if (template === 'owner') {
    return { accessTemplate: 'owner', financeAuthorized: true }
  }
  if (template === 'admin') {
    return { accessTemplate: 'admin', financeAuthorized: false }
  }
  return { accessTemplate: 'member', financeAuthorized: false }
}

/** Role string passed into hasPermission / assertPermission. */
export function permissionRoleOf(user: {
  role: string
  accessTemplate?: string | null
}): string {
  if (user.role === 'boss' || user.role === 'owner') return 'boss'
  if (
    user.accessTemplate === 'admin' ||
    user.accessTemplate === 'owner' ||
    user.accessTemplate === 'member'
  ) {
    return user.accessTemplate
  }
  return user.role
}
