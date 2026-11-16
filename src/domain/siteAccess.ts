/** Employee site visibility — boss sees all; members only assigned sites. */

import { isBossLike } from '@/domain/roleGroups'

function seesAllSites(input: {
  role: string
  accessTemplate?: string | null
}): boolean {
  if (isBossLike(input)) return true
  return input.role === 'admin' || input.accessTemplate === 'admin'
}

export function filterSitesByAccess<T extends { id: string }>(input: {
  role: string
  accessTemplate?: string | null
  sites: T[]
  allowedSiteIds: string[] | null | undefined
  /**
   * When false/undefined and the employee has no personal assignments yet,
   * treat ACL as not configured and show all org sites (bootstrap).
   * When true, empty assignment means no access.
   */
  orgHasAssignments?: boolean
}): T[] {
  if (seesAllSites(input)) {
    return input.sites
  }
  const allowed = new Set(input.allowedSiteIds ?? [])
  if (allowed.size === 0) {
    if (input.orgHasAssignments === true) return []
    return input.sites
  }
  return input.sites.filter((s) => allowed.has(s.id))
}

export function assertCanAccessSite(input: {
  role: string
  accessTemplate?: string | null
  siteId: string
  allowedSiteIds: string[] | null | undefined
  orgHasAssignments?: boolean
}): void {
  if (seesAllSites(input)) {
    return
  }
  const allowed = new Set(input.allowedSiteIds ?? [])
  if (allowed.size === 0) {
    if (input.orgHasAssignments === true) {
      throw new Error('無權限存取此工地')
    }
    return
  }
  if (!allowed.has(input.siteId)) {
    throw new Error('無權限存取此工地')
  }
}
