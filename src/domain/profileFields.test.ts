import { describe, expect, it } from 'vitest'
import {
  assertAccountStatus,
  normalizeProfileFields,
} from './profileFields'

describe('profile fields', () => {
  it('normalizes optional dates and trims', () => {
    expect(
      normalizeProfileFields({
        nickname: ' 阿明 ',
        birthDate: '1990-05-01',
        jobTitle: '水電',
        hiredAt: '',
        notes: null,
      }),
    ).toEqual({
      nickname: '阿明',
      birthDate: '1990-05-01',
      jobTitle: '水電',
      hiredAt: null,
      notes: null,
    })
    expect(() =>
      normalizeProfileFields({ birthDate: '05/01/1990' }),
    ).toThrow(/生日/)
  })

  it('account status', () => {
    expect(assertAccountStatus('disabled')).toBe('disabled')
    expect(() => assertAccountStatus('banned')).toThrow(/帳號狀態/)
  })
})
