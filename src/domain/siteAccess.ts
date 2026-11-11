/** Employee site visibility — boss sees all; members only assigned sites. */

export function filterSitesByAccess<T extends { id: string }>(input: {
  role: string
  sites: T[]
  allowedSiteIds: string[] | null | undefined
  /**
   * When false/undefined and the employee has no personal assignments yet,
   * treat ACL as not configured and show all org sites (bootstrap).
   * When true, empty assignment means no access.
   */
  orgHasAssignments?: boolean
}): T[] {
  if (input.role === 'boss' || input.role === 'owner' || input.role === 'admin') {
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
  siteId: string
  allowedSiteIds: string[] | null | undefined
  orgHasAssignments?: boolean
}): void {
  if (input.role === 'boss' || input.role === 'owner' || input.role === 'admin') {
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
