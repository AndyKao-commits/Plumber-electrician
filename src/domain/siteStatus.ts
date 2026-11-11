import type { ProjectStatus } from '@/domain/types'

export const SITE_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '進行中',
  pending_close: '待結案',
  closed: '已結案',
  warranty: '保固中',
}

/** 列表預設顯示（不含已結案） */
export function isOpenSiteStatus(status: ProjectStatus): boolean {
  return status !== 'closed'
}

/** 選工地／指派用：排除已結案 */
export function selectOpenSites<T extends { status: ProjectStatus }>(
  sites: T[],
): T[] {
  return sites.filter((s) => isOpenSiteStatus(s.status))
}

export function assertSiteStatus(value: string): ProjectStatus {
  if (
    value === 'active' ||
    value === 'pending_close' ||
    value === 'closed' ||
    value === 'warranty'
  ) {
    return value
  }
  throw new Error('工地狀態無效')
}

/** 老闆可操作的狀態轉換 */
export function assertSiteStatusTransition(input: {
  from: ProjectStatus
  to: ProjectStatus
}): void {
  const { from, to } = input
  if (from === to) return
  const allowed: Record<ProjectStatus, ProjectStatus[]> = {
    active: ['pending_close', 'closed', 'warranty'],
    pending_close: ['active', 'closed', 'warranty'],
    closed: ['active', 'warranty'],
    warranty: ['active', 'closed'],
  }
  if (!allowed[from].includes(to)) {
    throw new Error(
      `無法從「${SITE_STATUS_LABELS[from]}」改為「${SITE_STATUS_LABELS[to]}」`,
    )
  }
}
