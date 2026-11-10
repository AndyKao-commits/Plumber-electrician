import { describe, expect, it } from 'vitest'
import {
  assertWarrantyAssessmentRationale,
  isAutoFreeByWarrantyDates,
  isFullyFreeWarranty,
  requiresChargeAfterAssessment,
} from './warranty'

describe('WAR-001 保固判定', () => {
  it('保固期內不自動免費；必須人工判定理由', () => {
    expect(
      isAutoFreeByWarrantyDates({
        now: '2026-11-11',
        warrantyStart: '2026-01-01',
        warrantyEnd: '2027-01-01',
      }),
    ).toBe(false)
    expect(() => assertWarrantyAssessmentRationale('')).toThrow(/理由/)
    expect(assertWarrantyAssessmentRationale('  非保固範圍  ')).toBe(
      '非保固範圍',
    )
  })

  it('排除／過期需收費；covered 可免費（成本另記）', () => {
    expect(requiresChargeAfterAssessment('excluded')).toBe(true)
    expect(requiresChargeAfterAssessment('out_of_period')).toBe(true)
    expect(requiresChargeAfterAssessment('partial')).toBe(true)
    expect(isFullyFreeWarranty('covered')).toBe(true)
    expect(isFullyFreeWarranty('excluded')).toBe(false)
  })
})
