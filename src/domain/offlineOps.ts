/** Offline-allowed vs must-be-online operations (OPS / INT-10). */

export const OFFLINE_ALLOWED_OPS = [
  'construction_report',
  'manual_todo',
  'attendance_clock_in',
  'attendance_clock_out',
  'attendance_assign_site',
  'location_checkin',
  'expense_report',
  'cash_receipt',
] as const

export type OfflineAllowedOp = (typeof OFFLINE_ALLOWED_OPS)[number]

export const ONLINE_REQUIRED_OPS = [
  'purchase_create',
  'purchase_approve',
  'purchase_reject',
  'inventory_inbound',
  'inventory_adjust',
  'inventory_transfer',
  'inventory_reserve',
  'quote_publish',
  'quote_create',
] as const

export type OnlineRequiredOp = (typeof ONLINE_REQUIRED_OPS)[number]

export type SyncOpType = OfflineAllowedOp | OnlineRequiredOp

const ALLOWED = new Set<string>(OFFLINE_ALLOWED_OPS)
const BLOCKED = new Set<string>(ONLINE_REQUIRED_OPS)

export function isOfflineAllowed(op: string): op is OfflineAllowedOp {
  return ALLOWED.has(op)
}

export function requiresOnline(op: string): boolean {
  return BLOCKED.has(op) || !ALLOWED.has(op)
}

export function assertOnlineForOp(op: OnlineRequiredOp | string, online: boolean): void {
  if (!online && (BLOCKED.has(op) || !ALLOWED.has(op))) {
    throw new Error('此操作需連線後才能完成（不可離線正式生效）')
  }
}

export const OFFLINE_OP_LABELS: Record<OfflineAllowedOp, string> = {
  construction_report: '施工回報',
  manual_todo: '待辦草稿',
  attendance_clock_in: '上班打卡（待驗證）',
  attendance_clock_out: '下班打卡（待驗證）',
  attendance_assign_site: '補登工地（待驗證）',
  location_checkin: '定位回報（待同步）',
  expense_report: '支出回報（待同步）',
  cash_receipt: '收款回報（待同步）',
}

/** Stable request hash for INT-10 idempotency (same key + different body → conflict). */
export function hashRequestPayload(payload: unknown): string {
  const normalized = stableStringify(payload)
  let h = 2166136261
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}
