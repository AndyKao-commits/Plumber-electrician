import { describe, expect, it } from 'vitest'
import {
  applyDisbursementCredit,
  assertApproveDoesNotCreditBalance,
  assertCanApprove,
  assertRequestDisbursable,
  canApprovePettyCashTopUp,
  canDisbursePettyCash,
  canRequestPettyCashTopUp,
} from './pettyCash'

describe('PET-001 petty cash', () => {
  it('request / approve / disburse are separated', () => {
    expect(canRequestPettyCashTopUp('employee')).toBe(true)
    expect(canApprovePettyCashTopUp('employee')).toBe(false)
    expect(canApprovePettyCashTopUp('boss')).toBe(true)
    expect(canDisbursePettyCash('boss')).toBe(true)
    expect(() => assertCanApprove('employee')).toThrow(/僅 Owner/)
    expect(() => assertRequestDisbursable('pending_approval')).toThrow(
      /核准不等於撥款/,
    )
    expect(() => assertRequestDisbursable('approved')).not.toThrow()
  })

  it('approve does not credit; disburse does', () => {
    expect(() =>
      assertApproveDoesNotCreditBalance({
        balanceBefore: 1000,
        balanceAfterApprove: 1000,
      }),
    ).not.toThrow()
    expect(() =>
      assertApproveDoesNotCreditBalance({
        balanceBefore: 1000,
        balanceAfterApprove: 1500,
      }),
    ).toThrow(/核准不可直接入帳/)
    expect(applyDisbursementCredit({ balance: 1000, amount: 500 })).toBe(1500)
  })
})
