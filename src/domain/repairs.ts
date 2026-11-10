/**
 * REP-001: independent repair cases, dispatch, multi-visit.
 * - Create with problem description only (no forced customer/site).
 * - Visits never auto-create attendance (REP-03).
 */
import type { RepairCaseStatus } from './types'

export type { RepairCaseStatus }

export const REPAIR_STATUS_LABELS: Record<RepairCaseStatus, string> = {
  pending_schedule: '待安排',
  scheduled: '已安排',
  in_progress: '處理中',
  pending_confirm: '待確認',
  closed: '已結案',
  paused: '暫停',
  cancelled: '已取消',
}

export function assertProblemDescription(description: string): string {
  const trimmed = description.trim()
  if (!trimmed) throw new Error('問題描述為必填（可不填客戶或工地）')
  return trimmed
}

/** REP-01: only problem description required. */
export function canCreateRepairWithProblemOnly(input: {
  problemDescription: string
  customerName?: string | null
  siteId?: string | null
  customerId?: string | null
}): { ok: true; problemDescription: string } | { ok: false; reason: string } {
  try {
    return {
      ok: true,
      problemDescription: assertProblemDescription(input.problemDescription),
    }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : '無法建立維修',
    }
  }
}

export function nextRepairStatusAfterDispatch(
  current: RepairCaseStatus,
): RepairCaseStatus {
  if (current === 'pending_schedule' || current === 'paused') return 'scheduled'
  return current
}

export function nextRepairStatusAfterVisit(
  current: RepairCaseStatus,
): RepairCaseStatus {
  if (
    current === 'pending_schedule' ||
    current === 'scheduled' ||
    current === 'paused'
  ) {
    return 'in_progress'
  }
  return current
}

/**
 * REP-03: recording a visit must not create attendance.
 * Callers must not invoke attendance APIs from visit creation.
 */
export function visitCreatesAttendance(): false {
  return false
}
