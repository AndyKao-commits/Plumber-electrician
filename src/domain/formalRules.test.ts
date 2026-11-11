import { describe, expect, it } from 'vitest'
import {
  assertCanApproveAttendanceCorrection,
  assertCanApprovePurchase,
  assertSameOrganization,
  canApproveAttendanceCorrection,
  canApprovePurchase,
  hasPermission,
  mapLegacyRoleToSpec,
  PERMISSIONS,
} from './permissions'
import {
  assertEmergencyReserveAllowed,
  shouldAutoReleaseOnRefund,
  sumOccupiedQuota,
} from './emergencyLimits'
import {
  applyInboundMovingAverage,
  applyReturnAgainstInbound,
} from './inventoryCost'
import {
  assertQuoteAssociation,
  calcFinalPayable,
  calcQuoteTax,
  requiresPreApproval,
} from './rules'

describe('採購門檻 POL-001/002', () => {
  it('NT$2,999 不需一般事前核准', () => {
    expect(requiresPreApproval(2999)).toBe(false)
  })
  it('NT$3,000 必須一般事前核准', () => {
    expect(requiresPreApproval(3000)).toBe(true)
  })
  it('緊急單筆 NT$5,000 可接受', () => {
    expect(() =>
      assertEmergencyReserveAllowed({ eventsForDay: [], reserveAmount: 5000 }),
    ).not.toThrow()
  })
  it('緊急單筆 NT$5,001 拒絕', () => {
    expect(() =>
      assertEmergencyReserveAllowed({ eventsForDay: [], reserveAmount: 5001 }),
    ).toThrow(/單次/)
  })
  it('每日累計 NT$10,000 可接受', () => {
    expect(() =>
      assertEmergencyReserveAllowed({
        eventsForDay: [
          {
            id: '1',
            organizationId: 'o',
            employeeId: 'e',
            businessDate: '2026-11-10',
            type: 'RESERVE',
            amountDelta: 5000,
            createdAt: '',
            createdBy: 'e',
          },
        ],
        reserveAmount: 5000,
      }),
    ).not.toThrow()
  })
  it('每日累計超過 NT$10,000 拒絕', () => {
    expect(() =>
      assertEmergencyReserveAllowed({
        eventsForDay: [
          {
            id: '1',
            organizationId: 'o',
            employeeId: 'e',
            businessDate: '2026-11-10',
            type: 'RESERVE',
            amountDelta: 6000,
            createdAt: '',
            createdBy: 'e',
          },
        ],
        reserveAmount: 5000,
      }),
    ).toThrow(/每日/)
  })
  it('申請人不可自行核准', () => {
    expect(
      canApprovePurchase({
        actorRole: 'boss',
        actorId: 'u1',
        requesterId: 'u1',
      }),
    ).toBe(false)
    expect(() =>
      assertCanApprovePurchase({
        actorRole: 'boss',
        actorId: 'u1',
        requesterId: 'u1',
      }),
    ).toThrow(/自行核准/)
  })
  it('取消 RELEASE 針對原業務日占額加總', () => {
    expect(
      sumOccupiedQuota([
        {
          id: '1',
          organizationId: 'o',
          employeeId: 'e',
          businessDate: '2026-11-10',
          type: 'RESERVE',
          amountDelta: 4800,
          createdAt: '',
          createdBy: 'e',
        },
        {
          id: '2',
          organizationId: 'o',
          employeeId: 'e',
          businessDate: '2026-11-10',
          type: 'RELEASE',
          amountDelta: -4800,
          createdAt: '',
          createdBy: 'boss',
        },
      ]),
    ).toBe(0)
  })
  it('退款不得自動釋放占額', () => {
    expect(shouldAutoReleaseOnRefund()).toBe(false)
  })
  it('最終應付金額計算', () => {
    expect(
      calcFinalPayable({
        goodsAmount: 3000,
        discount: 200,
        tax: 140,
        shipping: 100,
      }),
    ).toBe(3040)
  })
})

describe('報價 REV-01/03', () => {
  it('兩者皆空拒絕', () => {
    expect(() => assertQuoteAssociation({})).toThrow(/XOR/)
  })
  it('兩者同時存在拒絕', () => {
    expect(() =>
      assertQuoteAssociation({ projectId: 'a', repairCaseId: 'b' }),
    ).toThrow(/XOR/)
  })
  it('只存在其中一個通過', () => {
    expect(() => assertQuoteAssociation({ projectId: 'a' })).not.toThrow()
    expect(() => assertQuoteAssociation({ repairCaseId: 'r' })).not.toThrow()
  })
  it('稅務計算 exclusive', () => {
    const r = calcQuoteTax({ amountBeforeTax: 10000, taxMode: 'exclusive' })
    expect(r.taxAmount).toBe(500)
    expect(r.amountAfterTax).toBe(10500)
  })
})

describe('庫存 POL-003 / REV-06', () => {
  it('入庫數量 <= 0 拒絕', () => {
    expect(() =>
      applyInboundMovingAverage({
        oldQty: 1,
        oldUnitCost: 10,
        inboundQty: 0,
        inboundUnitCost: 10,
      }),
    ).toThrow(/大於 0/)
  })
  it('移動加權平均正確', () => {
    const next = applyInboundMovingAverage({
      oldQty: 10,
      oldUnitCost: 100,
      inboundQty: 10,
      inboundUnitCost: 120,
    })
    expect(next.qty).toBe(20)
    expect(next.unitCost).toBe(110)
  })
  it('零庫存重新入庫使用新成本', () => {
    const next = applyInboundMovingAverage({
      oldQty: 0,
      oldUnitCost: 999,
      inboundQty: 5,
      inboundUnitCost: 40,
    })
    expect(next.unitCost).toBe(40)
  })
  it('退貨不把庫存打成負數', () => {
    expect(() =>
      applyReturnAgainstInbound({
        poolQty: 2,
        poolUnitCost: 10,
        returnQty: 5,
        originalInboundUnitCost: 10,
      }),
    ).toThrow(/超過庫存/)
  })
})

describe('權限與組織隔離', () => {
  it('boss→owner、employee→member', () => {
    expect(mapLegacyRoleToSpec('boss')).toBe('owner')
    expect(mapLegacyRoleToSpec('employee')).toBe('member')
  })
  it('member 預設無敏感財務', () => {
    expect(hasPermission('employee', PERMISSIONS.SENSITIVE_FINANCE)).toBe(false)
  })
  it('Admin 可核准採購與發布報價，但無 finance.*', () => {
    expect(hasPermission('admin', PERMISSIONS.PURCHASE_APPROVE)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.QUOTE_PUBLISH)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.FINANCE_READ)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.FINANCE_COST_READ)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.FINANCE_WRITE)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_MARGIN)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_PAYROLL_OTHERS)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.SENSITIVE_BANK)).toBe(false)
  })
  it('Member 具備盤點調整權限代碼（UI 下一批）', () => {
    expect(hasPermission('member', PERMISSIONS.INVENTORY_ADJUST)).toBe(true)
    expect(hasPermission('employee', PERMISSIONS.INVENTORY_INBOUND)).toBe(true)
  })
  it('self-approve 永遠拒絕', () => {
    expect(hasPermission('boss', PERMISSIONS.PURCHASE_SELF_APPROVE)).toBe(false)
  })
  it('Member 不可核准；Owner/Admin 可核准他人', () => {
    expect(canApprovePurchase({
      actorRole: 'employee',
      actorId: 'a1',
      requesterId: 'm1',
    })).toBe(false)
    expect(canApprovePurchase({
      actorRole: 'boss',
      actorId: 'boss1',
      requesterId: 'm1',
    })).toBe(true)
    expect(canApprovePurchase({
      actorRole: 'admin',
      actorId: 'admin1',
      requesterId: 'm1',
    })).toBe(true)
    expect(() =>
      assertCanApprovePurchase({
        actorRole: 'boss',
        actorId: 'same',
        requesterId: 'same',
      }),
    ).toThrow(/自行核准/)
  })
  it('Member 不可發布報價；Admin/Owner 可以', () => {
    expect(hasPermission('employee', PERMISSIONS.QUOTE_PUBLISH)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.QUOTE_PUBLISH)).toBe(true)
    expect(hasPermission('boss', PERMISSIONS.QUOTE_PUBLISH)).toBe(true)
  })
  it('跨組織拒絕', () => {
    expect(() => assertSameOrganization('org-a', 'org-b')).toThrow(/其他組織/)
    expect(() => assertSameOrganization('org-a', 'org-a')).not.toThrow()
  })
  it('補打卡：Owner/Admin 可核准他人；Member 不可；禁止自核', () => {
    expect(hasPermission('boss', PERMISSIONS.ATTENDANCE_CORRECT_APPROVE)).toBe(
      true,
    )
    expect(hasPermission('admin', PERMISSIONS.ATTENDANCE_CORRECT_APPROVE)).toBe(
      true,
    )
    expect(
      hasPermission('employee', PERMISSIONS.ATTENDANCE_CORRECT_APPROVE),
    ).toBe(false)
    expect(
      canApproveAttendanceCorrection({
        actorRole: 'boss',
        actorId: 'boss1',
        requesterId: 'm1',
      }),
    ).toBe(true)
    expect(
      canApproveAttendanceCorrection({
        actorRole: 'member',
        actorId: 'm1',
        requesterId: 'm2',
      }),
    ).toBe(false)
    expect(() =>
      assertCanApproveAttendanceCorrection({
        actorRole: 'boss',
        actorId: 'same',
        requesterId: 'same',
      }),
    ).toThrow(/自行核准/)
  })
})
