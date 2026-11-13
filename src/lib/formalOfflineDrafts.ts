/**
 * Formal-mode optimistic drafts while offline (not demo localDb seed data).
 * Cleared after successful sync of the matching clientOperationId.
 */
import type { AttendanceRecord } from '@/domain/types'

const ATT_KEY = 'eg.formalOfflineAttendance.v1'

function readAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AttendanceRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAttendance(rows: AttendanceRecord[]) {
  localStorage.setItem(ATT_KEY, JSON.stringify(rows))
}

export function upsertFormalAttendanceDraft(record: AttendanceRecord) {
  const all = readAttendance().filter((r) => r.id !== record.id)
  all.unshift(record)
  writeAttendance(all.slice(0, 40))
}

export function getFormalOpenAttendanceDraft(
  userId: string,
): AttendanceRecord | null {
  return (
    readAttendance().find(
      (r) => r.userId === userId && r.status === 'clocked_in' && !r.clockOutAt,
    ) ?? null
  )
}

export function listFormalAttendanceDrafts(userId: string): AttendanceRecord[] {
  return readAttendance()
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt))
}

export function patchFormalAttendanceDraft(
  userId: string,
  patch: Partial<AttendanceRecord> & { matchOpen?: boolean },
): AttendanceRecord | null {
  const all = readAttendance()
  const idx = all.findIndex((r) => {
    if (r.userId !== userId) return false
    if (patch.matchOpen) return r.status === 'clocked_in' && !r.clockOutAt
    if (patch.id) return r.id === patch.id
    return false
  })
  if (idx < 0) return null
  const updated = { ...all[idx], ...patch }
  delete (updated as { matchOpen?: boolean }).matchOpen
  all[idx] = updated
  writeAttendance(all)
  return updated
}

export function removeFormalAttendanceDraft(id: string) {
  writeAttendance(readAttendance().filter((r) => r.id !== id))
}

export function removeFormalAttendanceDraftByClientOp(clientOperationId: string) {
  writeAttendance(
    readAttendance().filter(
      (r) =>
        r.id !== `pending-${clientOperationId}` &&
        !r.id.endsWith(clientOperationId),
    ),
  )
}
