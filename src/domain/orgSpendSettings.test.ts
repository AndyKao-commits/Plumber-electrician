import { describe, expect, it } from 'vitest'
import {
  assertSpendSettingsInput,
  assertWithinDailyPurchaseLimit,
  requiresBossReview,
} from './orgSpendSettings'

describe('org spend settings', () => {
  it('validates limits and review threshold', () => {
    expect(
      assertSpendSettingsInput({
        reportReviewThresholdNtd: 3000,
        emergencySingleLimitNtd: 5000,
        emergencyDailyLimitNtd: 10000,
        dailyPurchaseLimitNtd: 0,
      }).emergencySingleLimitNtd,
    ).toBe(5000)
    expect(() =>
      assertSpendSettingsInput({
        reportReviewThresholdNtd: 3000,
        emergencySingleLimitNtd: 8000,
        emergencyDailyLimitNtd: 5000,
        dailyPurchaseLimitNtd: 0,
      }),
    ).toThrow(/每日上限不可小於單次/)
  })

  it('review threshold and daily purchase cap', () => {
    expect(requiresBossReview(3000, 3000)).toBe(true)
    expect(requiresBossReview(2999, 3000)).toBe(false)
    expect(() =>
      assertWithinDailyPurchaseLimit({
        usedTodayNtd: 28000,
        nextAmount: 3000,
        dailyPurchaseLimitNtd: 30000,
      }),
    ).toThrow(/每日採購上限/)
  })
})
