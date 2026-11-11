/** LINE conversation flow rules. Keep in sync with line-webhook. */

export const LINE_FLOW_TYPES = [
  'photo_upload',
  'todos',
  'attendance',
  /** V1.0 圖文選單「記帳」→ expense_reports / cash_receipt_reports */
  'purchase',
  /** 到點打卡／足跡 */
  'location',
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
  purchase: '記帳',
  location: '紀錄地點',
}

export type FieldCashKind = 'expense' | 'receipt'

export const FIELD_CASH_KIND_LABELS: Record<FieldCashKind, string> = {
  expense: '支出回報',
  receipt: '收款回報',
}

export const PAUSE_AFTER_MS = 30 * 60 * 1000
export const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000

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
): LineFlowType | 'cancel' | 'resume' | 'open_app' | null {
  const t = text.trim()
  if (!t) return null
  if (/^(取消操作|取消流程|取消)$/.test(t)) return 'cancel'
  if (/^(繼續操作|繼續)$/.test(t)) return 'resume'
  if (/進入工地|工程系統|工程管家主頁|^主頁$/.test(t)) return 'open_app'
  if (/上傳照片|傳送照片|傳照片|施工照片/.test(t)) return 'photo_upload'
  if (/待辦事項|我的待辦|^待辦$/.test(t)) return 'todos'
  if (/出勤打卡|上下班|上班打卡|下班打卡|切換工地/.test(t)) return 'attendance'
  if (/紀錄地點|記錄地點|到點打卡|足跡/.test(t)) return 'location'
  if (/^記帳$|支出|收款|採購申請|材料採購|^採購$|支出／收款|支出\/收款/.test(t))
    return 'purchase'
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

/** V1.0 field cash draft (expense / cash receipt). */
export function summarizeFieldCashDraft(payload: {
  kind?: string | null
  siteName?: string | null
  item?: string | null
  sourceNote?: string | null
  amount?: number | null
  receiptCount?: number | null
}): { filled: string; pending: string } {
  const filled: string[] = []
  const pending: string[] = []
  const kind = payload.kind === 'receipt' ? 'receipt' : payload.kind === 'expense' ? 'expense' : null
  if (kind) filled.push(FIELD_CASH_KIND_LABELS[kind])
  else pending.push('選擇支出或收款')
  if (payload.siteName) filled.push('工地')
  else if (kind) pending.push('選擇工地')
  if (kind === 'expense') {
    if (payload.item) filled.push('項目')
    else if (payload.siteName) pending.push('填寫項目')
  } else if (kind === 'receipt') {
    if (payload.sourceNote) filled.push('來源')
  }
  if (payload.amount != null && payload.amount > 0) filled.push('金額')
  else if (kind === 'expense' ? payload.item : payload.siteName) pending.push('填寫金額')
  if ((payload.receiptCount ?? 0) > 0) {
    filled.push(`${payload.receiptCount} 張收據`)
  }
  if (payload.amount != null && payload.amount > 0) pending.push('確認送出')
  return {
    filled: filled.length ? filled.join('、') : '尚無',
    pending: pending.length ? pending.join('、') : '確認送出',
  }
}

/** @deprecated use summarizeFieldCashDraft */
export function summarizePurchaseDraft(payload: {
  mode?: string | null
  title?: string | null
  goodsAmount?: number | null
  siteName?: string | null
  kind?: string | null
  item?: string | null
  amount?: number | null
}): { filled: string; pending: string } {
  if (payload.kind === 'expense' || payload.kind === 'receipt') {
    return summarizeFieldCashDraft({
      kind: payload.kind,
      siteName: payload.siteName,
      item: payload.item ?? payload.title,
      amount: payload.amount ?? payload.goodsAmount,
    })
  }
  return summarizeFieldCashDraft({
    kind: 'expense',
    siteName: payload.siteName,
    item: payload.title,
    amount: payload.goodsAmount,
  })
}

export function photoTypeFromLabelOrCode(input: string): PhotoType | null {
  const t = input.trim()
  if ((PHOTO_TYPES as readonly string[]).includes(t)) return t as PhotoType
  const entry = Object.entries(PHOTO_TYPE_LABELS).find(([, label]) => label === t)
  return entry ? (entry[0] as PhotoType) : null
}

export function parseFieldCashKind(input: string): FieldCashKind | null {
  const t = input.trim()
  if (t === 'expense' || /支出/.test(t)) return 'expense'
  if (t === 'receipt' || /收款/.test(t)) return 'receipt'
  return null
}

export function calcSimpleFinalPayable(goodsAmount: number): number {
  return Math.round((Number(goodsAmount) || 0) * 100) / 100
}
