import { describe, expect, it } from 'vitest'
import {
  assertCanSoftDeleteQuoteCase,
  assertCanSoftDeleteQuoteVersion,
  canSoftDeleteQuoteCase,
  canSoftDeleteQuoteVersion,
} from './quoteDelete'

describe('報價軟刪除規則', () => {
  it('Admin／Owner 可刪除未接受案件', () => {
    expect(
      canSoftDeleteQuoteCase('admin', {
        workflowStatus: 'exported',
        deletedAt: null,
      }).ok,
    ).toBe(true)
    expect(
      canSoftDeleteQuoteCase('boss', {
        workflowStatus: 'editing',
        deletedAt: null,
      }).ok,
    ).toBe(true)
  })

  it('Member 不可刪除案件', () => {
    const r = canSoftDeleteQuoteCase('employee', {
      workflowStatus: 'editing',
      deletedAt: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/無權刪除/)
  })

  it('客戶已接受案件不可刪除', () => {
    const r = canSoftDeleteQuoteCase('admin', {
      workflowStatus: 'accepted',
      deletedAt: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/已接受/)
    expect(() =>
      assertCanSoftDeleteQuoteCase('owner', {
        workflowStatus: 'accepted',
        deletedAt: null,
      }),
    ).toThrow(/已接受/)
  })

  it('已提供客戶或已接受時不可刪歷史版本', () => {
    expect(
      canSoftDeleteQuoteVersion(
        'admin',
        { workflowStatus: 'exported' },
        { versionNo: 1, deletedAt: null },
      ).ok,
    ).toBe(true)

    const sent = canSoftDeleteQuoteVersion(
      'admin',
      { workflowStatus: 'sent_to_customer' },
      { versionNo: 1, deletedAt: null },
    )
    expect(sent.ok).toBe(false)

    const accepted = canSoftDeleteQuoteVersion(
      'owner',
      { workflowStatus: 'accepted' },
      { versionNo: 2, deletedAt: null },
    )
    expect(accepted.ok).toBe(false)
    expect(() =>
      assertCanSoftDeleteQuoteVersion(
        'admin',
        { workflowStatus: 'accepted' },
        { versionNo: 1, deletedAt: null },
      ),
    ).toThrow(/不可刪除/)
  })

  it('Member 不可刪歷史版本', () => {
    const r = canSoftDeleteQuoteVersion(
      'member',
      { workflowStatus: 'exported' },
      { versionNo: 1, deletedAt: null },
    )
    expect(r.ok).toBe(false)
  })
})
