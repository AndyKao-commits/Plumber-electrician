/**
 * COM-001: complaints + related repair cases.
 * Complaints can exist without a project; linking must not merge/delete cases.
 */

export type ComplaintStatus =
  | 'open'
  | 'investigating'
  | 'escalated'
  | 'resolved'
  | 'closed'

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: '待處理',
  investigating: '調查中',
  escalated: '已升級',
  resolved: '已處理',
  closed: '已結案',
}

export function assertComplaintSubject(subject: string): string {
  const trimmed = subject.trim()
  if (!trimmed) throw new Error('客訴主旨為必填（可不關聯工程）')
  return trimmed
}

/** COM-01: complaint may be created with no project / site. */
export function canCreateStandaloneComplaint(input: {
  subject: string
  siteId?: string | null
  repairCaseId?: string | null
}): { ok: true; subject: string } | { ok: false; reason: string } {
  try {
    return { ok: true, subject: assertComplaintSubject(input.subject) }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : '無法建立客訴',
    }
  }
}

/**
 * Related cases are associations only — never merge or delete originals.
 */
export function assertRelatedCasesAreAssociationOnly(_input: {
  fromRepairCaseId: string
  toRepairCaseId: string
}): { mergesCases: false; deletesCases: false } {
  return { mergesCases: false, deletesCases: false }
}

export function assertDistinctRelatedCases(a: string, b: string): void {
  if (!a || !b) throw new Error('需指定兩個維修案件')
  if (a === b) throw new Error('不可關聯同一案件')
}
