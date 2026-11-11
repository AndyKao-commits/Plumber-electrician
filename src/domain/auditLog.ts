/** V1.0 required operation audit trail. */
export type AuditAction =
  | 'expense.create'
  | 'expense.update'
  | 'expense.confirm'
  | 'expense.return'
  | 'expense.cancel'
  | 'receipt.create'
  | 'receipt.confirm'
  | 'receipt.return'
  | 'receipt.cancel'
  | 'site.create'
  | 'site.update'
  | 'site.delete'
  | 'todo.create'
  | 'todo.assign'
  | 'todo.complete'
  | 'profile.update'
  | 'permission.update'
  | 'line.bind'
  | 'line.unbind'

export type AuditEntryInput = {
  action: AuditAction
  actorId: string
  actorName: string
  targetType: string
  targetId: string
  before?: unknown
  after?: unknown
  result: 'ok' | 'error'
  message?: string
}

export function buildAuditEntry(input: AuditEntryInput) {
  return {
    ...input,
    id: `aud-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  }
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'expense.create': '建立支出',
  'expense.update': '修改支出',
  'expense.confirm': '審核支出',
  'expense.return': '退回支出',
  'expense.cancel': '取消支出',
  'receipt.create': '回報收款',
  'receipt.confirm': '確認收款',
  'receipt.return': '退回收款',
  'receipt.cancel': '取消收款',
  'site.create': '建立案件',
  'site.update': '修改案件',
  'site.delete': '刪除案件',
  'todo.create': '建立待辦',
  'todo.assign': '指派待辦',
  'todo.complete': '完成待辦',
  'profile.update': '修改員工資料',
  'permission.update': '修改權限',
  'line.bind': 'LINE 綁定',
  'line.unbind': 'LINE 解除綁定',
}
