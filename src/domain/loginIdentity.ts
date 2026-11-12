/**
 * Login accounts mapped onto Supabase Auth email/password.
 * Preferred account form is phone digits; custom ids and real emails still work.
 */

export const AUTH_LOGIN_EMAIL_DOMAIN = 'login.eg.local'

const LOGIN_ID_RE = /^[a-z][a-z0-9._-]{2,31}$/
const PHONE_LOGIN_RE = /^[0-9]{8,15}$/

export function looksLikeEmail(value: string): boolean {
  const t = value.trim()
  return t.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** Strip spaces / dashes / leading +886 → local 0… digits when possible. */
export function normalizePhoneDigits(raw: string): string {
  let s = raw.trim().replace(/[\s\-()]/g, '')
  if (s.startsWith('+886')) s = `0${s.slice(4)}`
  else if (s.startsWith('886') && s.length >= 11) s = `0${s.slice(3)}`
  return s.replace(/\D/g, '')
}

export function isPhoneLoginId(value: string): boolean {
  return PHONE_LOGIN_RE.test(value)
}

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase()
}

export function assertPhoneAccount(raw: string): string {
  const digits = normalizePhoneDigits(raw)
  if (!PHONE_LOGIN_RE.test(digits)) {
    throw new Error('請填寫有效電話（8–15 位數字，例如 0912345678）')
  }
  if (digits.length < 6) {
    throw new Error('電話過短，無法作為預設密碼（至少 6 碼）')
  }
  return digits
}

export function assertLoginId(raw: string): string {
  const digits = normalizePhoneDigits(raw)
  if (PHONE_LOGIN_RE.test(digits) && !/[a-zA-Z@]/.test(raw.trim())) {
    return assertPhoneAccount(raw)
  }
  const id = normalizeLoginId(raw)
  if (!id) throw new Error('請填寫帳號')
  if (looksLikeEmail(id)) {
    throw new Error('此欄請填電話或自訂帳號；Email 請整段填在帳號欄即可')
  }
  if (!LOGIN_ID_RE.test(id)) {
    throw new Error(
      '帳號可為電話，或 3–32 碼自訂帳號（開頭英文字母，僅小寫英文、數字、. _ -）',
    )
  }
  if (id.includes('@')) throw new Error('帳號格式無效')
  return id
}

/** Map UI account field → Auth email used by Supabase. */
export function accountToAuthEmail(account: string): {
  authEmail: string
  loginId: string | null
  isSynthetic: boolean
} {
  const trimmed = account.trim()
  if (!trimmed) throw new Error('請填寫帳號')
  if (looksLikeEmail(trimmed)) {
    const email = trimmed.toLowerCase()
    if (email.endsWith('@' + AUTH_LOGIN_EMAIL_DOMAIN)) {
      const local = email.slice(0, -(AUTH_LOGIN_EMAIL_DOMAIN.length + 1))
      return {
        authEmail: email,
        loginId: assertLoginId(local),
        isSynthetic: true,
      }
    }
    return { authEmail: email, loginId: null, isSynthetic: false }
  }
  const loginId = assertLoginId(trimmed)
  return {
    authEmail: `${loginId}@${AUTH_LOGIN_EMAIL_DOMAIN}`,
    loginId,
    isSynthetic: true,
  }
}

export function loginIdFromAuthEmail(
  email: string | null | undefined,
): string | null {
  if (!email) return null
  const e = email.trim().toLowerCase()
  const suffix = '@' + AUTH_LOGIN_EMAIL_DOMAIN
  if (!e.endsWith(suffix)) return null
  const local = e.slice(0, -suffix.length)
  if (LOGIN_ID_RE.test(local) || PHONE_LOGIN_RE.test(local)) return local
  return null
}
