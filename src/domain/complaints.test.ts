import { describe, expect, it } from 'vitest'
import {
  assertDistinctRelatedCases,
  assertRelatedCasesAreAssociationOnly,
  canCreateStandaloneComplaint,
} from './complaints'

describe('COM-001 客訴', () => {
  it('可不關聯工程建立客訴', () => {
    expect(canCreateStandaloneComplaint({ subject: '服務態度' })).toEqual({
      ok: true,
      subject: '服務態度',
    })
    expect(canCreateStandaloneComplaint({ subject: '  ' }).ok).toBe(false)
  })

  it('重複案件只關聯不合併刪除', () => {
    expect(
      assertRelatedCasesAreAssociationOnly({
        fromRepairCaseId: 'a',
        toRepairCaseId: 'b',
      }),
    ).toEqual({ mergesCases: false, deletesCases: false })
    expect(() => assertDistinctRelatedCases('a', 'a')).toThrow(/同一案件/)
  })
})
