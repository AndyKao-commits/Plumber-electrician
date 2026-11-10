/** Map unknown errors to Traditional Chinese user messages. */

export function toUserMessage(error: unknown, fallback = '操作失敗，請稍後再試'): string {
  if (!error) return fallback
  if (typeof error === 'string' && error.trim()) return error

  const anyErr = error as {
    message?: string
    code?: string
    details?: string
    hint?: string
  }

  const msg = anyErr.message ?? ''
  const code = anyErr.code ?? ''

  if (/JWT|not authenticated|Auth session missing/i.test(msg) || code === '401') {
    return '尚未登入或登入已過期，請重新登入'
  }
  if (/User already registered|already been registered/i.test(msg)) {
    return '此 Email 已註冊，請改為登入'
  }
  if (/Password should be at least/i.test(msg)) {
    return '密碼至少 6 碼'
  }
  if (/Email not confirmed/i.test(msg)) {
    return 'Email 尚未驗證，請先完成信箱確認或請管理員關閉 Confirm email'
  }
  if (/signup.*disabled|Signups not allowed/i.test(msg)) {
    return '目前未開放自行註冊，請聯絡管理員'
  }
  if (/permission denied|row-level security|RLS|42501/i.test(msg) || code === '42501') {
    return '權限不足，無法存取此資料'
  }
  if (/duplicate key|23505/i.test(msg) || code === '23505') {
    return '資料重複，請勿重複送出'
  }
  if (/foreign key|23503/i.test(msg) || code === '23503') {
    return '關聯資料不存在或已被刪除'
  }
  if (/check constraint|23514/i.test(msg) || code === '23514') {
    return '資料不符合規則，請檢查後再試'
  }
  if (/invalid input syntax for type uuid/i.test(msg) || code === '22P02') {
    return '選取的資料 ID 無效，請重新選擇工地／案件後再送出'
  }
  if (/network|Failed to fetch|fetch/i.test(msg)) {
    return '網路連線失敗，請檢查網路後再試'
  }
  if (msg.includes('禁止申請人自行核准')) return msg
  if (msg.includes('不得存取其他組織')) return msg
  if (msg.includes('ID 無效')) return msg
  if (msg.includes('超過緊急')) return msg
  if (msg.includes('報價')) return msg
  if (msg.includes('庫存')) return msg
  if (msg.includes('無權')) return msg
  if (msg.includes('尚未設定')) return msg
  if (msg.trim()) return msg

  return fallback
}

export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function requireFormalOrDemo<T>(
  isFormal: boolean,
  formalFn: () => Promise<T>,
  demoFn: () => Promise<T> | T,
): Promise<T> {
  if (isFormal) return formalFn()
  return Promise.resolve(demoFn())
}
