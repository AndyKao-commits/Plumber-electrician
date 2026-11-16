import { describe, expect, it } from 'vitest'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  isBossLike,
  isPrimaryBoss,
  permissionRoleOf,
  templateToAccessFields,
} from '@/domain/roleGroups'

describe('roleGroups', () => {
  it('maps finance template to member + finance flag', () => {
    const fields = templateToAccessFields('finance')
    expect(fields.accessTemplate).toBe('member')
    expect(fields.financeAuthorized).toBe(true)
    expect(fields.features.expenses).toBe(true)
    expect(fields.features.site_delete).toBe(false)
  })

  it('permissionRoleOf prefers accessTemplate for employees', () => {
    expect(
      permissionRoleOf({ role: 'employee', accessTemplate: 'admin' }),
    ).toBe('admin')
    expect(permissionRoleOf({ role: 'boss', accessTemplate: 'member' })).toBe(
      'boss',
    )
  })

  it('owner template employee is boss-like for operations', () => {
    const delegate = { role: 'employee', accessTemplate: 'owner' as const }
    expect(isPrimaryBoss(delegate)).toBe(false)
    expect(isBossLike(delegate)).toBe(true)
    expect(permissionRoleOf(delegate)).toBe('boss')
  })

  it('admin template can approve purchases without finance.read', () => {
    const role = permissionRoleOf({
      role: 'employee',
      accessTemplate: 'admin',
    })
    expect(hasPermission(role, PERMISSIONS.PURCHASE_APPROVE)).toBe(true)
    expect(hasPermission(role, PERMISSIONS.FINANCE_READ)).toBe(false)
  })
})
