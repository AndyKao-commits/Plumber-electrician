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
      unpaidTotal: 30000,
      workDays: 0,
    })
  })

  it('prefers payment records over legacy paid status for 實領', () => {
    const entries = [
      { status: 'confirmed', amount: 20000 },
      { status: 'paid', amount: 1000 },
    ] as SalaryEntry[]
    const payments = [{ amount: 15000 }] as import('./types').SalaryPayment[]
    const s = summarizeSalaryMonth(entries, payments)
    expect(s.confirmedTotal).toBe(21000)
    expect(s.paidTotal).toBe(15000)
    expect(s.unpaidTotal).toBe(6000)
  })
})
