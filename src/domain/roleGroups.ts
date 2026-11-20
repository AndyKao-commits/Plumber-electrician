import {
  featuresForTemplate,
  normalizeFeatureMap,
  type FeatureMap,
} from '@/domain/featureAccess'
import type { SpecRole } from '@/domain/permissions'
import type { UserRole } from '@/domain/types'

/** Named identity group the boss can assign to teammates. */
export type RoleGroupTemplate = SpecRole | 'finance'

export interface RoleGroupDefinition {
  id: string
  name: string
  /** Maps onto SpecRole; finance = member + financeAuthorized */
  template: RoleGroupTemplate
  financeAuthorized: boolean
  features: FeatureMap
  builtIn?: boolean
}

export const BUILTIN_ROLE_GROUPS: RoleGroupDefinition[] = [
  {
    id: 'grp-owner',
    name: '老闆／管理者',
    template: 'owner',
    financeAuthorized: true,
    features: featuresForTemplate('owner'),
    builtIn: true,
  },
  {
    id: 'grp-admin',
    name: '管理員',
    template: 'admin',
    financeAuthorized: false,
    features: featuresForTemplate('admin'),
    builtIn: true,
  },
  {
    id: 'grp-member',
    name: '師傅',
    template: 'member',
    financeAuthorized: false,
    features: featuresForTemplate('member'),
    builtIn: true,
  },
  {
    id: 'grp-finance',
    name: '會計',
    template: 'finance',
    financeAuthorized: true,
    features: featuresForTemplate('finance'),
    builtIn: true,
  },
]

export const ROLE_GROUP_TEMPLATE_LABELS: Record<RoleGroupTemplate, string> = {
  owner: '老闆（全部權限）',
  admin: '管理員（營運核准，不含敏感財務）',
  member: '師傅（現場作業）',
  finance: '會計（敏感財務授權）',
}

export function templateToAccessFields(template: RoleGroupTemplate): {
  accessTemplate: SpecRole
  financeAuthorized: boolean
  features: FeatureMap
} {
  if (template === 'finance') {
    return {
      accessTemplate: 'member',
      financeAuthorized: true,
      features: featuresForTemplate('finance'),
    }
  }
  if (template === 'owner') {
    return {
      accessTemplate: 'owner',
      financeAuthorized: true,
      features: featuresForTemplate('owner'),
    }
  }
  if (template === 'admin') {
    return {
      accessTemplate: 'admin',
      financeAuthorized: false,
      features: featuresForTemplate('admin'),
    }
  }
  return {
    accessTemplate: 'member',
    financeAuthorized: false,
    features: featuresForTemplate('member'),
  }
}

/** True org boss account (profiles.role). Used for backend access control. */
export function isPrimaryBoss(
  user: { role: string } | null | undefined,
): boolean {
  return user?.role === 'boss' || user?.role === 'owner'
}

/**
 * Boss-equivalent: primary boss, or employee assigned「老闆／管理者」
 * (accessTemplate owner) so a field account can 結案／審核 without switching.
 */
export function isBossLike(
  user:
    | {
        role: string
        accessTemplate?: string | null
      }
    | null
    | undefined,
): boolean {
  if (!user) return false
  if (isPrimaryBoss(user)) return true
  return user.accessTemplate === 'owner'
}

/** Role passed into hasPermission / assertPermission. */
export function permissionRoleOf(user: {
  role: string
  accessTemplate?: string | null
}): UserRole | SpecRole {
  if (isPrimaryBoss(user) || user.accessTemplate === 'owner') return 'boss'
  if (user.accessTemplate === 'admin' || user.role === 'admin') return 'admin'
  if (user.accessTemplate === 'member' || user.role === 'member') return 'member'
  return 'employee'
}

export function withNormalizedFeatures(
  group: Omit<RoleGroupDefinition, 'features'> & {
    features?: Partial<FeatureMap> | null
  },
): RoleGroupDefinition {
  const defaults = templateToAccessFields(group.template).features
  return {
    ...group,
    features: normalizeFeatureMap(group.features, defaults),
  }
}
