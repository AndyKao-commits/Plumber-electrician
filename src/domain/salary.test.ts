import { describe, expect, it } from 'vitest'
import {
  assertSalaryAmount,
  periodFromDate,
  summarizeSalaryMonth,
} from './salary'
import type { SalaryEntry } from './types'

describe('salary domain', () => {
  it('normalizes deduction to negative', () => {
    expect(assertSalaryAmount(500, 'deduction')).toBe(-500)
    expect(assertSalaryAmount(1000, 'base')).toBe(1000)
    expect(() => assertSalaryAmount(10.5, 'base')).toThrow(/整數/)
  })

  it('period from date', () => {
    expect(periodFromDate('2026-11-11')).toEqual({ year: 2026, month: 11 })
  })

  it('summarizes month keeping pending separate', () => {
    const entries = [
      { status: 'confirmed', amount: 30000 },
      { status: 'pending', amount: 2000 },
      { status: 'paid', amount: 1000 },
      { status: 'cancelled', amount: 999 },
    ] as SalaryEntry[]
    expect(summarizeSalaryMonth(entries)).toEqual({
      confirmedTotal: 31000,
      pendingTotal: 2000,
      paidTotal: 1000,
    })
  })
})
