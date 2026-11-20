/** @deprecated Prefer domain/permissions — kept for import compatibility. */
export {
  assertCanApprovePurchase,
  canApprovePurchase,
} from './permissions'

/** Owner-equivalent accounts may self-approve; Admin/Member may not. */
export const ALLOW_OWNER_SELF_APPROVAL = true
