/** LINE conversation flow rules. Keep in sync with line-webhook. */

export const LINE_FLOW_TYPES = [
  'photo_upload',
  'todos',
  'attendance',
  'purchase',
] as const
export type LineFlowType = (typeof LINE_FLOW_TYPES)[number]

export const LINE_FLOW_STATUSES = [
  'idle',
  'collecting',
  'awaiting_confirmation',
  'processing',
  'completed',
  'cancelled',
  'paused',
  'expired',
] as const
export type LineFlowStatus = (typeof LINE_FLOW_STATUSES)[number]

export const ACTIVE_FLOW_STATUSES: readonly LineFlowStatus[] = [
  'collecting',
  'awaiting_confirmation',
  'processing',
  'paused',
]

export const PHOTO_TYPES = [
  'before',
  'during',
  'after',
  'acceptance',
  'unclassified',
] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  before: '施工前',
  during: '施工中',
  after: '施工後',
  acceptance: '驗收',
  unclassified: '尚未分類',
}

export const FLOW_TYPE_LABELS: Record<LineFlowType, string> = {
  photo_upload: '上傳照片',
  todos: '待辦事項',
  attendance: '出勤打卡',
  purchase: '採購申請',
}

export const PAUSE_AFTER_MS = 30 * 60 * 1000
export const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000

export const PURCHASE_PREAPPROVAL_THRESHOLD_NTD = 3000
export const EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD = 5000
export const EMERGENCY_PURCHASE_DAILY_LIMIT_NTD = 10_000

export type ActivityAge = 'fresh' | 'paused' | 'expired'

export function classifyActivityAge(
  lastActivityAt: string | Date,
  now = Date.now(),
): ActivityAge {
  const t =
    typeof lastActivityAt === 'string'
      ? new Date(lastActivityAt).getTime()
      : lastActivityAt.getTime()
  if (Number.isNaN(t)) return 'expired'
  const age = now - t
  if (age <= PAUSE_AFTER_MS) return 'fresh'
  if (age <= EXPIRE_AFTER_MS) return 'paused'
  return 'expired'
}

export function isActiveFlowStatus(status: string): boolean {
  return (ACTIVE_FLOW_STATUSES as readonly string[]).includes(status)
}

export function isFlowStartIntent(value: string): value is LineFlowType {
  return (LINE_FLOW_TYPES as readonly string[]).includes(value)
}

export function parseMenuIntent(
  text: string,
): LineFlowType | 'cancel' | 'resume' | null {
  const t = text.trim()
  if (!t) return null
  if (/^(取消操作|取消流程|取消)$/.test(t)) return 'cancel'
  if (/^(繼續操作|繼續)$/.test(t)) return 'resume'
  if (/上傳照片|傳送照片|傳照片|施工照片/.test(t)) return 'photo_upload'
  if (/待辦事項|我的待辦|^待辦$/.test(t)) return 'todos'
  if (/出勤打卡|上下班|上班打卡|下班打卡|切換工地/.test(t)) return 'attendance'
  if (/採購申請|材料採購|^採購$/.test(t)) return 'purchase'
  return null
}

export function parsePostbackData(data: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of data.split('&')) {
    const [k, ...rest] = part.split('=')
    if (!k) continue
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

export function summarizePhotoDraft(payload: {
  siteName?: string | null
  photoType?: string | null
  photoCount?: number | null
  step?: string | null
}): { filled: string; pending: string } {
  const filled: string[] = []
  const pending: string[] = []
  if (payload.siteName) filled.push('工地')
  else pending.push('選擇工地')
  if (payload.photoType) filled.push('照片類型')
  else if (payload.siteName) pending.push('選擇照片類型')
  if ((payload.photoCount ?? 0) > 0) filled.push(`${payload.photoCount} 張照片`)
  else if (payload.photoType) pending.push('傳送照片')
  if (payload.step === 'receiving' || (payload.photoCount ?? 0) > 0) {
    pending.push('完成上傳')
  }
  return {
    filled: filled.length ? filled.join('、') : '尚無',
    pending: pending.length ? pending.join('、') : '確認送出',
  }
}

export function summarizePurchaseDraft(payload: {
  mode?: string | null
  title?: string | null
  goodsAmount?: number | null
  siteName?: string | null
}): { filled: string; pending: string } {
  const filled: string[] = []
  const pending: string[] = []
  if (payload.mode) filled.push(payload.mode === 'emergency' ? '緊急採購' : '一般採購')
  else pending.push('選擇類型')
  if (payload.title) filled.push('品名')
  else if (payload.mode) pending.push('填寫品名')
  if (payload.goodsAmount != null && payload.goodsAmount >= 0) filled.push('金額')
  else if (payload.title) pending.push('填寫金額')
  if (payload.siteName) filled.push('工地')
  if (payload.title && payload.goodsAmount != null) pending.push('確認送出')
  return {
    filled: filled.length ? filled.join('、') : '尚無',
    pending: pending.length ? pending.join('、') : '確認送出',
  }
}

export function photoTypeFromLabelOrCode(input: string): PhotoType | null {
  const t = input.trim()
  if ((PHOTO_TYPES as readonly string[]).includes(t)) return t as PhotoType
  const entry = Object.entries(PHOTO_TYPE_LABELS).find(([, label]) => label === t)
  return entry ? (entry[0] as PhotoType) : null
}

export function calcSimpleFinalPayable(goodsAmount: number): number {
  return Math.round((Number(goodsAmount) || 0) * 100) / 100
}

export function requiresPreApproval(finalPayable: number): boolean {
  return finalPayable >= PURCHASE_PREAPPROVAL_THRESHOLD_NTD
}
