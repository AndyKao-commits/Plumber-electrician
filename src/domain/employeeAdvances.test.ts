import { describe, expect, it } from 'vitest'
import {
  assertAdvanceItem,
  assertCanCancelAdvance,
  assertCanSettleAdvances,
  buildSettleExpenseItem,
  sumAdvanceAmounts,
} from './employeeAdvances'

describe('employeeAdvances', () => {
  it('validates item', () => {
    expect(assertAdvanceItem(' 水泥 ')).toBe('水泥')
    expect(() => assertAdvanceItem('')).toThrow(/代墊項目/)
  })

  it('boss settle guards', () => {
    expect(() =>
      assertCanSettleAdvances({ actorRole: 'member', selectedIds: ['a'] }),
    ).toThrow(/老闆/)
    expect(() =>
      assertCanSettleAdvances({ actorRole: 'boss', selectedIds: [] }),
    ).toThrow(/至少選/)
    expect(() =>
      assertCanSettleAdvances({ actorRole: 'boss', selectedIds: ['a'] }),
    ).not.toThrow()
  })

  it('boss may cancel open or settled advances', () => {
    expect(() =>
      assertCanCancelAdvance({ actorRole: 'employee', status: 'open' }),
    ).toThrow(/老闆/)
    expect(() =>
      assertCanCancelAdvance({ actorRole: 'boss', status: 'cancelled' }),
    ).toThrow(/已取消/)
    expect(() =>
      assertCanCancelAdvance({ actorRole: 'boss', status: 'settled' }),
    ).not.toThrow()
  })

  it('sums selected open advances', () => {
    expect(
      sumAdvanceAmounts(
        [
          { id: '1', amount: 100, status: 'open' },
          { id: '2', amount: 50, status: 'settled' },
          { id: '3', amount: 20, status: 'open' },
        ],
        ['1', '2', '3'],
      ),
    ).toBe(120)
    expect(buildSettleExpenseItem(2)).toContain('2 筆')
  })
})
