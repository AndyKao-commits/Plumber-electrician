/**
 * WAR-001 / REP-04/05: warranty master + human assessment.
 * Never auto-free from calendar alone; free work still keeps cost elsewhere.
 */
import type { WarrantyAssessmentClassification } from './types'

export const WARRANTY_ASSESSMENT_LABELS: Record<
  WarrantyAssessmentClassification,
  string
> = {
  covered: '保固範圍內（免費）',
  partial: '部分保固',
  excluded: '排除項目（不免費）',
  out_of_period: '已過保固期',
  not_warranty: '非保固案件',
}

export function assertWarrantyAssessmentRationale(rationale: string): string {
  const trimmed = rationale.trim()
  if (!trimmed) throw new Error('保固判定必須填寫理由（不可僅依日期自動免費）')
  return trimmed
}

/**
 * REP-04: being inside warranty window must NOT imply free service.
 * Caller must choose an explicit classification.
 */
export function isAutoFreeByWarrantyDates(_input: {
  now: Date | string
  warrantyStart?: string | null
  warrantyEnd?: string | null
}): false {
  return false
}

export function requiresChargeAfterAssessment(
  classification: WarrantyAssessmentClassification,
): boolean {
  return (
    classification === 'excluded' ||
    classification === 'out_of_period' ||
    classification === 'not_warranty' ||
    classification === 'partial'
  )
}

export function isFullyFreeWarranty(
  classification: WarrantyAssessmentClassification,
): boolean {
  return classification === 'covered'
}
