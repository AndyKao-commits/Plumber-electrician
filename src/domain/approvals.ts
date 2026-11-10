import type { UserRole } from './types'

/** REV-07 safe default until Owner explicitly relaxes. */
export const ALLOW_SELF_APPROVAL = false

export function canApprovePurchase(input: {
  actorRole: UserRole
  actorId: string
  requesterId: string
  allowSelfApproval?: boolean
}): boolean {
  const allowSelf = input.allowSelfApproval ?? ALLOW_SELF_APPROVAL
  if (input.actorId === input.requesterId && !allowSelf) {
    return false
  }
  return input.actorRole === 'boss'
}

export function assertCanApprovePurchase(input: {
  actorRole: UserRole
  actorId: string
  requesterId: string
  allowSelfApproval?: boolean
}): void {
  if (!canApprovePurchase(input)) {
    if (input.actorId === input.requesterId) {
      throw new Error('禁止申請人自行核准自己的採購（REV-07）')
    }
    throw new Error('無權核准此採購')
  }
}
