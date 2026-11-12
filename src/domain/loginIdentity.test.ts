import { describe, expect, it } from 'vitest'
import {
  AUTH_LOGIN_EMAIL_DOMAIN,
  accountToAuthEmail,
  assertLoginId,
  loginIdFromAuthEmail,
  looksLikeEmail,
} from './loginIdentity'

describe('loginIdentity', () => {
  it('accepts custom login ids', () => {
    expect(assertLoginId('Ming_01')).toBe('ming_01')
    expect(accountToAuthEmail('Boss01')).toEqual({
      authEmail: `boss01@${AUTH_LOGIN_EMAIL_DOMAIN}`,
      loginId: 'boss01',
      isSynthetic: true,
    })
  })

  it('rejects bad login ids', () => {
    expect(() => assertLoginId('ab')).toThrow(/3/)
    expect(() => assertLoginId('1abc')).toThrow(/開頭/)
    expect(() => assertLoginId('你好')).toThrow(/帳號/)
  })

  it('keeps real emails as auth email', () => {
    expect(looksLikeEmail('a@b.com')).toBe(true)
    expect(accountToAuthEmail('Worker@Example.com')).toEqual({
      authEmail: 'worker@example.com',
      loginId: null,
      isSynthetic: false,
    })
  })

  it('round-trips synthetic emails', () => {
    expect(loginIdFromAuthEmail(`ming_01@${AUTH_LOGIN_EMAIL_DOMAIN}`)).toBe(
      'ming_01',
    )
    expect(loginIdFromAuthEmail('real@example.com')).toBeNull()
  })
})
