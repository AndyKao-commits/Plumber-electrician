import {
  EMERGENCY_PURCHASE_DAILY_LIMIT_NTD,
  EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD,
} from './rules'
import { roundMoney } from './money'

export type EmergencyLimitEventType = 'RESERVE' | 'RELEASE' | 'ADJUST'

export interface EmergencyLimitEvent {
  id: string
  organizationId: string
  employeeId: string
  /** Original business day in Asia/Taipei (yyyy-MM-dd). Immutable key. */
  businessDate: string
  type: EmergencyLimitEventType
  /** Signed amount contribution to daily occupied quota. RESERVE +, RELEASE -, ADJUST delta. */
  amountDelta: number
  purchaseId?: string | null
  reason?: string | null
  createdAt: string
  createdBy: string
}

export function sumOccupiedQuota(events: EmergencyLimitEvent[]): number {
  return roundMoney(events.reduce((sum, e) => sum + e.amountDelta, 0))
}

export function assertEmergencyReserveAllowed(input: {
  eventsForDay: EmergencyLimitEvent[]
  reserveAmount: number
  singleLimit?: number
  dailyLimit?: number
}): void {
  const amount = roundMoney(input.reserveAmount)
  const single = input.singleLimit ?? EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD
  const daily = input.dailyLimit ?? EMERGENCY_PURCHASE_DAILY_LIMIT_NTD

  if (amount <= 0) {
    throw new Error('緊急採購金額必須大於 0')
  }
  if (amount > single) {
    throw new Error(`超過緊急採購單次上限 NT$${single.toLocaleString()}`)
  }

  const occupied = sumOccupiedQuota(input.eventsForDay)
  if (roundMoney(occupied + amount) > daily) {
    throw new Error(
      `超過緊急採購每日累計上限 NT$${daily.toLocaleString()}（已占 NT$${occupied.toLocaleString()}）`,
    )
  }
}

/**
 * Refunds after the fact must NOT auto-release the original-day quota (REV-04).
 * Only an authorized RELEASE/ADJUST event may change occupied quota.
 */
export function shouldAutoReleaseOnRefund(): false {
  return false
}
