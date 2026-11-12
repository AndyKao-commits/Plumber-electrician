import { describe, expect, it } from 'vitest'
import {
  AUTH_LOGIN_EMAIL_DOMAIN,
  accountToAuthEmail,
  assertAccountForProvisioning,
  assertLoginId,
  assertPhoneAccount,
  loginIdFromAuthEmail,
  looksLikeEmail,
  normalizePhoneDigits,
} from './loginIdentity'

describe('loginIdentity', () => {
  it('normalizes Taiwan phones', () => {
    expect(normalizePhoneDigits('0912-345-678')).toBe('0912345678')
    expect(normalizePhoneDigits('+886912345678')).toBe('0912345678')
    expect(assertPhoneAccount('0912 345 678')).toBe('0912345678')
  })

  it('accepts phone as login id', () => {
    expect(assertLoginId('0912345678')).toBe('0912345678')
    expect(accountToAuthEmail('0912345678')).toEqual({
      authEmail: `0912345678@${AUTH_LOGIN_EMAIL_DOMAIN}`,
      loginId: '0912345678',
      isSynthetic: true,
    })
  })

  it('accepts custom login ids', () => {
    expect(assertLoginId('Ming_01')).toBe('ming_01')
    expect(accountToAuthEmail('Boss01')).toEqual({
      authEmail: `boss01@${AUTH_LOGIN_EMAIL_DOMAIN}`,
      loginId: 'boss01',
      isSynthetic: true,
    })
  })

  it('rejects bad accounts', () => {
    expect(() => assertPhoneAccount('123')).toThrow(/電話/)
    expect(() => assertLoginId('ab')).toThrow()
    expect(() => assertLoginId('你好')).toThrow()
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
    expect(loginIdFromAuthEmail(`0912345678@${AUTH_LOGIN_EMAIL_DOMAIN}`)).toBe(
      '0912345678',
    )
    expect(loginIdFromAuthEmail('real@example.com')).toBeNull()
  })

  it('provisions phone or custom accounts (min 6 for default password)', () => {
    expect(assertAccountForProvisioning('0912345678')).toEqual({
      loginId: '0912345678',
      phone: '0912345678',
    })
    expect(assertAccountForProvisioning('Worker01')).toEqual({
      loginId: 'worker01',
      phone: null,
    })
    expect(() => assertAccountForProvisioning('ab1')).toThrow(/至少 6/)
  })
})
