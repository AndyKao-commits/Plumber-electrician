/**
 * Custom login ids (帳號) mapped onto Supabase Auth email/password.
 * Real emails still work; non-email accounts become synthetic addresses.
 */

export const AUTH_LOGIN_EMAIL_DOMAIN = 'login.eg.local'

const LOGIN_ID_RE = /^[a-z][a-z0-9._-]{2,31}$/

export function looksLikeEmail(value: string): boolean {
  const t = value.trim()
  return t.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase()
}

export function assertLoginId(raw: string): string {
  const id = normalizeLoginId(raw)
  if (!id) throw new Error('請填寫帳號')
  if (looksLikeEmail(id)) {
    throw new Error('此欄請填自訂帳號；Email 請整段填在帳號欄即可')
  }
  if (!LOGIN_ID_RE.test(id)) {
    throw new Error(
      '帳號需 3–32 碼，開頭為英文字母，僅能用小寫英文、數字、. _ -',
    )
  }
  if (id.endsWith('.' + AUTH_LOGIN_EMAIL_DOMAIN) || id.includes('@')) {
    throw new Error('帳號格式無效')
  }
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

export function loginIdFromAuthEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const e = email.trim().toLowerCase()
  const suffix = '@' + AUTH_LOGIN_EMAIL_DOMAIN
  if (!e.endsWith(suffix)) return null
  const local = e.slice(0, -suffix.length)
  return LOGIN_ID_RE.test(local) ? local : null
}
