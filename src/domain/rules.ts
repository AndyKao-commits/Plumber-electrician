import { roundMoney } from './money'
import type {
  PurchaseRuleSnapshot,
  QuotationItem,
  QuotationItemKind,
  TaxMode,
  UserRole,
} from './types'
import { applyInboundMovingAverage } from './inventoryCost'

/** Confirmed product rules from planning conversations. */
export const PRODUCT = {
  name: '工程管家',
  tagline: '水電現場＋老闆審核（V1.0）',
  version: '1.0',
  sourceConversations: [
    'https://chatgpt.com/share/6af27b2e-31d8-83ee-9de3-c8287529caeb',
    'https://chatgpt.com/share/6af28019-cfd0-83ec-bf49-738de06277ea',
    'https://chatgpt.com/share/6af28a57-0b70-83ee-8496-f50778494099',
  ],
  planningClosed: true,
  /** V1.0：LINE 現場回報 → Supabase → 老闆網站審核／統計 */
  awaitingDevAuthorization: false,
  doc09Aligned: true,
  v1Simplified: true,
} as const

/**
 * V1.0 only two roles: Owner (boss) and Employee.
 * No multi-layer Admin / finance privilege matrix in primary UX.
 */
export const ROLES: Record<
  UserRole,
  { label: string; defaultFinanceAuth: boolean }
> = {
  boss: { label: '老闆', defaultFinanceAuth: true },
  employee: { label: '員工／師傅', defaultFinanceAuth: false },
}

/** POL-001 + 一般採購門檻：最終應付金額（折扣後含稅運） */
export const PURCHASE_PREAPPROVAL_THRESHOLD_NTD = 3000

/** 緊急採購單次上限 */
export const EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD = 5000

/** POL-002：緊急採購每人每日累計上限（Asia/Taipei） */
export const EMERGENCY_PURCHASE_DAILY_LIMIT_NTD = 10_000

export const DEFAULT_PURCHASE_RULES: PurchaseRuleSnapshot = {
  preApprovalThresholdNtd: PURCHASE_PREAPPROVAL_THRESHOLD_NTD,
  emergencySingleLimitNtd: EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD,
  emergencyDailyLimitNtd: EMERGENCY_PURCHASE_DAILY_LIMIT_NTD,
}

export const FEATURE_FLAGS = {
  /** V1.0：簡化現場流程；複雜 ERP 入口隱藏 */
  v1Simplified: true,
  offlineFirst: false,
  gpsOptionalOnClockIn: true,
  autoDeductBreak: false,
  payrollMonthly: false,
  simpleInventory: true,
  hybridInventory: false,
  lineOfficialAccount: true,
  lineGroupConfirmBeforeArchive: true,
  /** 全面停用系統主動 LINE 推播 */
  lineProactivePush: false,
  inAppNotificationsOnly: true,
  equalProjectPermissions: true,
  overnightShiftsAllowed: true,
  emailPasswordLoginPrimary: true,
  lineAsEntryOnly: true,
  movingAverageInventoryCost: false,
  quoteTaxChosenPerDocument: true,
  /** 隱藏：緊急額度／供應商信用／零用金／序號成本等 */
  showAdvancedErp: false,
} as const

export const BACKUP_TARGETS = {
  rpoHours: 1,
  rtoHours: 4,
} as const

/**
 * V1.0 information architecture
 * Bottom nav: 首頁 / 工地 / 收支 / 出勤 / 更多
 * Hidden for good: inventory stocktake, suppliers, petty cash ERP, analytics CRM packs.
 */
export const HOME_SHORTCUTS = [
  { id: 'photos', label: '施工照片', path: '/photos' },
  { id: 'quotes', label: '報價', path: '/quotes' },
  { id: 'todos', label: '待辦', path: '/todos' },
  { id: 'team', label: '今日團隊', path: '/team' },
  { id: 'profile', label: '個人資料', path: '/profile' },
] as const

export const MORE_MENU = [
  {
    id: 'work',
    label: '工作',
    items: [
      {
        id: 'todos',
        label: '待辦',
        path: '/todos',
        description: '今日事項與完成狀態',
      },
      {
        id: 'notices',
        label: '通知中心',
        path: '/notifications',
        description: '站內通知（不推 LINE）',
      },
      {
        id: 'photos',
        label: '施工照片',
        path: '/photos',
        description: '全工地照片歸檔',
      },
      {
        id: 'quotes',
        label: '報價',
        path: '/quotes',
        description: '案件報價與匯出',
      },
      {
        id: 'team',
        label: '今日團隊',
        path: '/team',
        description: '到班狀態與 LINE 綁定',
      },
      {
        id: 'reports',
        label: '施工回報',
        path: '/reports',
        description: '文字回報列表',
      },
    ],
  },
  {
    id: 'account',
    label: '帳號與管理',
    items: [
      {
        id: 'profile',
        label: '個人資料',
        path: '/profile',
        description: '暱稱、工種、到職資訊',
      },
      {
        id: 'settings',
        label: '額度設定',
        path: '/settings',
        description: '審核門檻與每日上限',
        bossOnly: true,
      },
      {
        id: 'audit',
        label: '操作紀錄',
        path: '/audit',
        description: '敏感操作稽核',
        bossOnly: true,
      },
    ],
  },
] as const

/** Routes kept for deep links / LINE but not shown in V1 menus. */
export const ADVANCED_ERP_PATHS = [
  '/inventory',
  '/petty-cash',
  '/suppliers',
  '/analytics',
  '/customers',
  '/repairs',
  '/complaints',
  '/purchases',
  '/offline-queue',
] as const

export type FinalPayableInput = {
  goodsAmount: number
  discount?: number
  tax?: number
  shipping?: number
  otherBuyerFees?: number
}

/** 最終應付金額 = 商品 - 折扣 + 稅 + 運費 + 其他應由買方負擔費用 */
export function calcFinalPayable(input: FinalPayableInput): number {
  const discount = input.discount ?? 0
  const tax = input.tax ?? 0
  const shipping = input.shipping ?? 0
  const other = input.otherBuyerFees ?? 0
  return roundMoney(input.goodsAmount - discount + tax + shipping + other)
}

export function calcQuoteTax(input: {
  amountBeforeTax: number
  taxMode: TaxMode
  taxRate?: number
}): { taxAmount: number; amountAfterTax: number; taxRate: number } {
  const rate = input.taxRate ?? (input.taxMode === 'zero' ? 0 : 0.05)
  if (input.taxMode === 'zero') {
    return {
      taxAmount: 0,
      amountAfterTax: roundMoney(input.amountBeforeTax),
      taxRate: 0,
    }
  }
  if (input.taxMode === 'exclusive') {
    const taxAmount = roundMoney(input.amountBeforeTax * rate)
    return {
      taxAmount,
      amountAfterTax: roundMoney(input.amountBeforeTax + taxAmount),
      taxRate: rate,
    }
  }
  // inclusive: amountBeforeTax is treated as tax-included total
  const amountAfterTax = roundMoney(input.amountBeforeTax)
  const taxAmount = roundMoney(amountAfterTax - amountAfterTax / (1 + rate))
  return { taxAmount, amountAfterTax, taxRate: rate }
}

export function assertQuoteAssociation(input: {
  projectId?: string | null
  repairCaseId?: string | null
}): void {
  const hasProject = Boolean(input.projectId)
  const hasRepair = Boolean(input.repairCaseId)
  if (hasProject === hasRepair) {
    throw new Error('報價必須恰好關聯一個工程或一個維修案件（REV-01 XOR）')
  }
}

export const QUOTE_ITEM_KIND_LABELS: Record<QuotationItemKind, string> = {
  material: '材料',
  labor: '工資',
  other: '其他',
}

/** Line amount = qty × unitPrice (rounded). Header sums these once (FIN-02). */
export function calcQuoteItemAmount(input: {
  qty: number
  unitPrice: number
}): number {
  const qty = Number(input.qty)
  const unitPrice = Number(input.unitPrice)
  if (!Number.isFinite(qty) || qty < 0) {
    throw new Error('數量不可為負')
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('單價不可為負')
  }
  return roundMoney(qty * unitPrice)
}

/** Sum line amounts once — material + labor are display kinds, not double-counted. */
export function sumQuoteItems(
  items: Array<Pick<QuotationItem, 'amount' | 'kind'>>,
): {
  total: number
  byKind: Record<QuotationItemKind, number>
} {
  const byKind: Record<QuotationItemKind, number> = {
    material: 0,
    labor: 0,
    other: 0,
  }
  let total = 0
  for (const item of items) {
    const amt = Number(item.amount) || 0
    total = roundMoney(total + amt)
    const kind = item.kind in byKind ? item.kind : 'other'
    byKind[kind] = roundMoney(byKind[kind] + amt)
  }
  return { total, byKind }
}

export function assertQuoteDraftEditable(input: {
  frozen?: boolean
  status?: string
  workflowStatus?: string
}): void {
  const ws = input.workflowStatus
  if (ws) {
    if (ws === 'accepted' || ws === 'cancelled') {
      throw new Error('此狀態不可修改報價細項（已接受或已取消）')
    }
    return
  }
  if (input.status === 'void') {
    throw new Error('已取消報價不可修改')
  }
}

export function requiresPreApproval(
  finalPayableNtd: number,
  thresholdNtd = PURCHASE_PREAPPROVAL_THRESHOLD_NTD,
): boolean {
  return finalPayableNtd >= thresholdNtd
}

export function isWithinEmergencySingleLimit(
  finalPayableNtd: number,
  singleLimitNtd = EMERGENCY_PURCHASE_SINGLE_LIMIT_NTD,
): boolean {
  return finalPayableNtd <= singleLimitNtd
}

export function isWithinEmergencyDailyLimit(
  usedTodayNtd: number,
  nextFinalPayableNtd: number,
  dailyLimitNtd = EMERGENCY_PURCHASE_DAILY_LIMIT_NTD,
): boolean {
  return usedTodayNtd + nextFinalPayableNtd <= dailyLimitNtd
}

export {
  canViewSensitiveFinance,
  canViewOthersPayroll,
} from './permissions'

/** Moving weighted average unit cost (org+material pool). */
export function movingAverageUnitCost(
  oldQty: number,
  oldUnitCost: number,
  inboundQty: number,
  inboundUnitCost: number,
): number {
  return applyInboundMovingAverage({
    oldQty,
    oldUnitCost,
    inboundQty,
    inboundUnitCost,
  }).unitCost
}
