/** @deprecated Prefer domain/permissions — kept for import compatibility. */
export {
  assertCanApprovePurchase,
  canApprovePurchase,
} from './permissions'

/** REV-07 safe default until Owner explicitly relaxes. */
export const ALLOW_SELF_APPROVAL = false
