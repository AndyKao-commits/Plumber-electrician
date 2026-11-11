import { describe, expect, it } from 'vitest'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  permissionRoleOf,
  templateToAccessFields,
} from '@/domain/roleGroups'

describe('roleGroups', () => {
  it('maps finance template to member + finance flag', () => {
    expect(templateToAccessFields('finance')).toEqual({
      accessTemplate: 'member',
      financeAuthorized: true,
    })
  })

  it('permissionRoleOf prefers accessTemplate for employees', () => {
    expect(
      permissionRoleOf({ role: 'employee', accessTemplate: 'admin' }),
    ).toBe('admin')
    expect(permissionRoleOf({ role: 'boss', accessTemplate: 'member' })).toBe(
      'boss',
    )
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
