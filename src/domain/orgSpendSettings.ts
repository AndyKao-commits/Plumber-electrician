/**
 * Boss-configurable spend limits (V1.0).
 * - emergency single / daily caps
 * - reportReviewThreshold = 零用金／現場支出超過此金額需老闆查核
 */
import { roundMoney } from './money'
import {
  EMERGENCY_PURCHASE_DAILY_LIMIT_NTD,
  EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD,
  PURCHASE_PREAPPROVAL_THRESHOLD_NTD,
} from './rules'

export type OrgSpendSettings = {
  organizationId: string
  /** 一般採購／支出超過此金額需回報查核（老闆審核） */
  reportReviewThresholdNtd: number
  /** 緊急採購單次上限 */
  emergencySingleLimitNtd: number
  /** 緊急採購每人每日累計上限 */
  emergencyDailyLimitNtd: number
  /** 每人每日採購合計上限（含一般＋緊急）；0＝不限制 */
  dailyPurchaseLimitNtd: number
  updatedAt: string
  updatedBy?: string | null
}

export function defaultOrgSpendSettings(
  organizationId = 'org-demo',
): OrgSpendSettings {
  return {
    organizationId,
    reportReviewThresholdNtd: PURCHASE_PREAPPROVAL_THRESHOLD_NTD,
    emergencySingleLimitNtd: EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD,
    emergencyDailyLimitNtd: EMERGENCY_PURCHASE_DAILY_LIMIT_NTD,
    /** 0＝不限制，老闆可在額度設定開啟每日上限 */
    dailyPurchaseLimitNtd: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  }
}

export function assertSpendSettingsInput(input: {
  reportReviewThresholdNtd: number
  emergencySingleLimitNtd: number
  emergencyDailyLimitNtd: number
  dailyPurchaseLimitNtd: number
}): Omit<OrgSpendSettings, 'organizationId' | 'updatedAt' | 'updatedBy'> {
  const report = roundMoney(Number(input.reportReviewThresholdNtd))
  const single = roundMoney(Number(input.emergencySingleLimitNtd))
  const daily = roundMoney(Number(input.emergencyDailyLimitNtd))
  const dayPurchase = roundMoney(Number(input.dailyPurchaseLimitNtd))
  if (report < 0) throw new Error('回報查核門檻不可為負')
  if (single <= 0) throw new Error('緊急單次上限必須大於 0')
  if (daily < single) {
    throw new Error('緊急每日上限不可小於單次上限')
  }
  if (dayPurchase < 0) throw new Error('每日採購上限不可為負')
  return {
    reportReviewThresholdNtd: report,
    emergencySingleLimitNtd: single,
    emergencyDailyLimitNtd: daily,
    dailyPurchaseLimitNtd: dayPurchase,
  }
}

export function requiresBossReview(
  amount: number,
  thresholdNtd: number,
): boolean {
  return roundMoney(amount) >= roundMoney(thresholdNtd)
}

export function assertWithinDailyPurchaseLimit(input: {
  usedTodayNtd: number
  nextAmount: number
  dailyPurchaseLimitNtd: number
}): void {
  const limit = roundMoney(input.dailyPurchaseLimitNtd)
  if (limit <= 0) return
  const next = roundMoney(input.usedTodayNtd + input.nextAmount)
  if (next > limit + 0.0001) {
    throw new Error(
      `超過每日採購上限 NT$${limit.toLocaleString()}（今日已用 NT$${roundMoney(input.usedTodayNtd).toLocaleString()}）`,
    )
  }
}
