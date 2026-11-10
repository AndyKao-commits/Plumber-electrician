import { describe, expect, it } from 'vitest'
import {
  assertCanApprovePurchase,
  assertCanManageAccess,
  assertCanPublishQuote,
  assertCanViewCost,
  assertCanViewSensitiveFinance,
  assertPermission,
  assertSameOrganization,
  canApprovePurchase,
  hasPermission,
  mapLegacyRoleToSpec,
  PERMISSIONS,
} from './permissions'
import { AppError, toUserMessage } from '@/lib/errors'
import { isUuid, optionalUuid, requireUuid } from '@/lib/ids'

describe('負向：無效 UUID', () => {
  it('rejects site-a / repair-1 / mat-pipe', () => {
    for (const bad of ['site-a', 'repair-1', 'mat-pipe', 'not-a-uuid', '']) {
      expect(isUuid(bad)).toBe(false)
      expect(() => requireUuid(bad, '工程')).toThrow(AppError)
      expect(() => requireUuid(bad, '工程')).toThrow(/工程 ID 無效/)
    }
  })

  it('accepts seed-style uuids', () => {
    expect(isUuid('22222222-2222-2222-2222-222222222221')).toBe(true)
    expect(optionalUuid('', '工地')).toBeNull()
  })

  it('toUserMessage keeps Chinese UUID errors without crashing', () => {
    const err = new AppError('工程 ID 無效，請重新選擇後再送出')
    expect(toUserMessage(err)).toContain('ID 無效')
    expect(
      toUserMessage({ message: 'invalid input syntax for type uuid: "site-a"' }),
    ).toContain('選取的資料 ID 無效')
  })
})

describe('負向：未授權角色', () => {
  it('Member 不可核准採購', () => {
    expect(
      canApprovePurchase({
        actorRole: 'employee',
        actorId: 'm1',
        requesterId: 'm2',
      }),
    ).toBe(false)
    expect(() =>
      assertCanApprovePurchase({
        actorRole: 'member',
        actorId: 'm1',
        requesterId: 'm2',
      }),
    ).toThrow(/無權核准/)
  })

  it('Member 不可發布報價', () => {
    expect(hasPermission('employee', PERMISSIONS.QUOTE_PUBLISH)).toBe(false)
    expect(() => assertCanPublishQuote('employee')).toThrow(/無權發布/)
    expect(() => assertPermission('member', PERMISSIONS.QUOTE_PUBLISH)).toThrow(
      /無權執行/,
    )
  })
})

describe('負向：Admin 敏感財務', () => {
  it('Admin 可核准採購但不可發布報價', () => {
    expect(hasPermission('admin', PERMISSIONS.PURCHASE_APPROVE)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.QUOTE_PUBLISH)).toBe(false)
    expect(
      canApprovePurchase({
        actorRole: 'admin',
        actorId: 'a1',
        requesterId: 'm1',
      }),
    ).toBe(true)
  })

  it('Admin 不可查看成本、毛利、薪資、銀行、權限管理', () => {
    expect(hasPermission('admin', PERMISSIONS.FINANCE_COST_READ)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_MARGIN)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_PAYROLL_OTHERS)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_BANK)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_ACCESS_CONTROL)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.FINANCE_READ)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_FINANCE)).toBe(false)

    expect(() => assertCanViewCost('admin')).toThrow(/無權查看成本/)
    expect(() => assertCanViewSensitiveFinance('admin')).toThrow(/無權查看敏感財務/)
    expect(() => assertCanManageAccess('admin')).toThrow(/無權管理存取權限/)
  })
})

describe('負向：自己核准自己的採購', () => {
  it('Owner/Admin self-approve denied', () => {
    expect(
      canApprovePurchase({
        actorRole: 'boss',
        actorId: 'same',
        requesterId: 'same',
      }),
    ).toBe(false)
    expect(() =>
      assertCanApprovePurchase({
        actorRole: 'admin',
        actorId: 'same',
        requesterId: 'same',
      }),
    ).toThrow(/自行核准/)
  })
})

describe('負向：跨 organization', () => {
  it('rejects mismatched org ids', () => {
    expect(() =>
      assertSameOrganization(
        '11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999999',
      ),
    ).toThrow(/其他組織/)
    expect(() => assertSameOrganization(null, 'org')).toThrow(/其他組織/)
    expect(() =>
      assertSameOrganization(
        '11111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
      ),
    ).not.toThrow()
  })
})

describe('角色對應穩定性', () => {
  it('boss→owner employee→member', () => {
    expect(mapLegacyRoleToSpec('boss')).toBe('owner')
    expect(mapLegacyRoleToSpec('employee')).toBe('member')
    expect(mapLegacyRoleToSpec('admin')).toBe('admin')
  })
})
