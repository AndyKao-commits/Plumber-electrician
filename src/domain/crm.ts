/**
 * CRM-001: customers, contacts, site links.
 * - Customer can be created with name only (CRM-01).
 * - Multiple customers may share the same site/address.
 */

export function assertCustomerName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('客戶名稱為必填（其餘欄位可後補）')
  return trimmed
}

export function assertContactName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('聯絡人名稱為必填')
  return trimmed
}

/** CRM-01: only name is required to create a customer. */
export function canCreateCustomerWithNameOnly(input: {
  name: string
  phone?: string | null
  notes?: string | null
}): { ok: true; name: string } | { ok: false; reason: string } {
  try {
    return { ok: true, name: assertCustomerName(input.name) }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : '無法建立客戶',
    }
  }
}

/**
 * Many customers may link to the same site (同址多客戶).
 * A customer may also link to many sites.
 */
export function assertCanLinkCustomerToSite(input: {
  customerId: string
  siteId: string
  existingLinks: Array<{ customerId: string; siteId: string }>
}): void {
  if (!input.customerId || !input.siteId) {
    throw new Error('客戶與地址皆為必填')
  }
  const dup = input.existingLinks.some(
    (l) => l.customerId === input.customerId && l.siteId === input.siteId,
  )
  if (dup) throw new Error('此客戶已關聯該地址')
}

export function customersSharingSite(
  siteId: string,
  links: Array<{ customerId: string; siteId: string }>,
): string[] {
  return links.filter((l) => l.siteId === siteId).map((l) => l.customerId)
}
