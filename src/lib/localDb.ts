import { assertCanApprovePurchase } from '@/domain/approvals'
import {
  assertEmergencyReserveAllowed,
  sumOccupiedQuota,
  type EmergencyLimitEvent,
} from '@/domain/emergencyLimits'
import { applyInboundMovingAverage } from '@/domain/inventoryCost'
import {
  assertQuoteAssociation,
  calcFinalPayable,
  calcQuoteTax,
} from '@/domain/rules'
import type {
  AppNotice,
  AppUser,
  AttendanceRecord,
  MaterialStock,
  PurchaseRecord,
  Quotation,
  RepairCase,
  SiteProject,
  TaxMode,
} from '@/domain/types'
import { formatTaipei } from '@/lib/time'

const ORG_ID = 'org-demo'

const KEYS = {
  sessionUserId: 'eg.sessionUserId',
  users: 'eg.users.v2',
  sites: 'eg.sites.v2',
  attendance: 'eg.attendance.v2',
  purchases: 'eg.purchases.v2',
  notices: 'eg.notices.v1',
  shortcuts: 'eg.shortcuts.v2',
  emergencyEvents: 'eg.emergencyEvents.v1',
  repairCases: 'eg.repairCases.v1',
  quotations: 'eg.quotations.v1',
  materials: 'eg.materials.v1',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const emptyUsers: AppUser[] = []
const emptySites: SiteProject[] = []
const emptyAttendance: AttendanceRecord[] = []
const emptyPurchases: PurchaseRecord[] = []
const emptyNotices: AppNotice[] = []
const emptyEvents: EmergencyLimitEvent[] = []
const emptyRepairs: RepairCase[] = []
const emptyQuotes: Quotation[] = []
const emptyMaterials: MaterialStock[] = []

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function seedIfNeeded() {
  const users = read(KEYS.users, emptyUsers)
  if (users.length > 0) return

  const now = new Date().toISOString()
  const seededUsers: AppUser[] = [
    {
      id: 'user-boss',
      organizationId: ORG_ID,
      name: '老闆',
      role: 'boss',
      email: 'boss@example.com',
      payType: 'monthly',
      financeAuthorized: true,
      createdAt: now,
    },
    {
      id: 'user-worker',
      organizationId: ORG_ID,
      name: '師傅阿明',
      role: 'employee',
      email: 'ming@example.com',
      payType: 'daily',
      financeAuthorized: false,
      createdAt: now,
    },
    {
      id: 'user-worker-2',
      organizationId: ORG_ID,
      name: '師傅阿強',
      role: 'employee',
      email: 'qiang@example.com',
      payType: 'daily',
      financeAuthorized: false,
      createdAt: now,
    },
  ]

  const seededSites: SiteProject[] = [
    {
      id: 'site-a',
      organizationId: ORG_ID,
      name: '忠孝東路住家整修',
      kind: 'formal',
      status: 'active',
      address: '台北市大安區忠孝東路四段',
      customerName: '林先生',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      id: 'site-b',
      organizationId: ORG_ID,
      name: '臨時漏水維修',
      kind: 'repair',
      status: 'active',
      address: '新北市板橋區文化路',
      customerName: '陳小姐',
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ]

  const seededNotices: AppNotice[] = [
    {
      id: 'notice-1',
      organizationId: ORG_ID,
      userId: 'user-boss',
      kind: 'todo',
      title: '採購申請待核准',
      detail: '最終應付金額 NT$3,150 · 系統內通知（無 LINE 推播）',
      status: 'open',
      unread: true,
      createdAt: now,
      href: '/purchases',
    },
    {
      id: 'notice-2',
      organizationId: ORG_ID,
      userId: 'user-boss',
      kind: 'notice',
      title: '明日工地行程更新',
      detail: '忠孝東路住家整修行程已調整',
      status: 'open',
      unread: true,
      createdAt: now,
      href: '/sites/site-a',
    },
    {
      id: 'notice-3',
      organizationId: ORG_ID,
      userId: 'user-worker',
      kind: 'todo',
      title: '補登目前工地',
      detail: '上班後記得選擇正在施工的工地',
      status: 'open',
      unread: true,
      createdAt: now,
      href: '/attendance',
    },
  ]

  const seededRepairs: RepairCase[] = [
    {
      id: 'repair-1',
      organizationId: ORG_ID,
      siteId: 'site-b',
      customerName: '陳小姐',
      title: '廚房水管漏水',
      createdAt: now,
    },
  ]

  const seededMaterials: MaterialStock[] = [
    {
      id: 'mat-pipe',
      organizationId: ORG_ID,
      name: 'PVC 管 4 分',
      unit: '支',
      qty: 20,
      unitCost: 45,
      updatedAt: now,
    },
    {
      id: 'mat-wire',
      organizationId: ORG_ID,
      name: '電線 2.0mm',
      unit: '米',
      qty: 100,
      unitCost: 12.5,
      updatedAt: now,
    },
  ]

  const seededPurchases: PurchaseRecord[] = [
    {
      id: 'pur-seed-pending',
      organizationId: ORG_ID,
      userId: 'user-worker',
      siteId: 'site-a',
      mode: 'normal',
      status: 'pending_approval',
      title: '止水材料（員工申請）',
      goodsAmount: 3000,
      discount: 0,
      tax: 0,
      shipping: 150,
      otherBuyerFees: 0,
      finalPayable: 3150,
      createdAt: now,
      businessDate: formatTaipei(now, 'yyyy-MM-dd'),
    },
  ]

  write(KEYS.users, seededUsers)
  write(KEYS.sites, seededSites)
  write(KEYS.attendance, emptyAttendance)
  write(KEYS.purchases, seededPurchases)
  write(KEYS.notices, seededNotices)
  write(KEYS.emergencyEvents, emptyEvents)
  write(KEYS.repairCases, seededRepairs)
  write(KEYS.quotations, emptyQuotes)
  write(KEYS.materials, seededMaterials)
  write(KEYS.shortcuts, [
    'clock',
    'sites',
    'purchase',
    'quotes',
    'inventory',
    'todos',
    'team',
    'notices',
  ])
}

seedIfNeeded()

export const localDb = {
  orgId: ORG_ID,

  getUsers(): AppUser[] {
    return read(KEYS.users, emptyUsers)
  },

  getUser(id: string): AppUser | null {
    return this.getUsers().find((u) => u.id === id) ?? null
  },

  getSessionUserId(): string | null {
    return localStorage.getItem(KEYS.sessionUserId)
  },

  setSessionUserId(id: string | null) {
    if (!id) localStorage.removeItem(KEYS.sessionUserId)
    else localStorage.setItem(KEYS.sessionUserId, id)
  },

  getSites(): SiteProject[] {
    return read(KEYS.sites, emptySites).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
  },

  getSite(id: string): SiteProject | null {
    return this.getSites().find((s) => s.id === id) ?? null
  },

  upsertSite(site: SiteProject) {
    const sites = this.getSites().filter((s) => s.id !== site.id)
    sites.unshift(site)
    write(KEYS.sites, sites)
  },

  getAttendance(): AttendanceRecord[] {
    return read(KEYS.attendance, emptyAttendance)
  },

  getOpenAttendance(userId: string): AttendanceRecord | null {
    return (
      this.getAttendance().find(
        (a) => a.userId === userId && a.status === 'clocked_in',
      ) ?? null
    )
  },

  saveAttendance(record: AttendanceRecord) {
    const all = this.getAttendance().filter((a) => a.id !== record.id)
    all.unshift(record)
    write(KEYS.attendance, all)
  },

  getPurchases(): PurchaseRecord[] {
    return read(KEYS.purchases, emptyPurchases)
  },

  savePurchase(record: PurchaseRecord) {
    const all = this.getPurchases().filter((p) => p.id !== record.id)
    all.unshift(record)
    write(KEYS.purchases, all)
  },

  getEmergencyEvents(): EmergencyLimitEvent[] {
    return read(KEYS.emergencyEvents, emptyEvents)
  },

  appendEmergencyEvent(event: EmergencyLimitEvent) {
    const all = this.getEmergencyEvents()
    all.unshift(event)
    write(KEYS.emergencyEvents, all)
  },

  emergencyEventsForDay(userId: string, businessDate: string) {
    return this.getEmergencyEvents().filter(
      (e) => e.employeeId === userId && e.businessDate === businessDate,
    )
  },

  emergencyUsedToday(userId: string, businessDate = formatTaipei(new Date(), 'yyyy-MM-dd')) {
    return sumOccupiedQuota(this.emergencyEventsForDay(userId, businessDate))
  },

  createPurchase(input: {
    userId: string
    title: string
    mode: PurchaseRecord['mode']
    siteId?: string
    goodsAmount: number
    discount?: number
    tax?: number
    shipping?: number
    otherBuyerFees?: number
  }): PurchaseRecord {
    const finalPayable = calcFinalPayable({
      goodsAmount: input.goodsAmount,
      discount: input.discount,
      tax: input.tax,
      shipping: input.shipping,
      otherBuyerFees: input.otherBuyerFees,
    })
    const businessDate = formatTaipei(new Date(), 'yyyy-MM-dd')
    const needsApproval = input.mode === 'normal' && finalPayable >= 3000

    if (input.mode === 'emergency') {
      const dayEvents = this.emergencyEventsForDay(input.userId, businessDate)
      assertEmergencyReserveAllowed({
        eventsForDay: dayEvents,
        reserveAmount: finalPayable,
      })
    }

    const record: PurchaseRecord = {
      id: `pur-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      userId: input.userId,
      siteId: input.siteId ?? null,
      mode: input.mode,
      status: needsApproval ? 'pending_approval' : 'purchased',
      title: input.title.trim(),
      goodsAmount: input.goodsAmount,
      discount: input.discount ?? 0,
      tax: input.tax ?? 0,
      shipping: input.shipping ?? 0,
      otherBuyerFees: input.otherBuyerFees ?? 0,
      finalPayable,
      createdAt: new Date().toISOString(),
      businessDate,
    }
    this.savePurchase(record)

    if (input.mode === 'emergency') {
      this.appendEmergencyEvent({
        id: `ele-${crypto.randomUUID()}`,
        organizationId: ORG_ID,
        employeeId: input.userId,
        businessDate,
        type: 'RESERVE',
        amountDelta: finalPayable,
        purchaseId: record.id,
        reason: '緊急採購占額',
        createdAt: record.createdAt,
        createdBy: input.userId,
      })
    }

    if (needsApproval) {
      const notices = read(KEYS.notices, emptyNotices)
      notices.unshift({
        id: `notice-${crypto.randomUUID()}`,
        organizationId: ORG_ID,
        userId: 'user-boss',
        kind: 'todo',
        title: `採購待核准：${record.title}`,
        detail: `最終應付 NT$${finalPayable.toLocaleString()}（無 LINE 推播）`,
        status: 'open',
        unread: true,
        createdAt: record.createdAt,
        href: '/purchases',
      })
      write(KEYS.notices, notices)
    }

    return record
  },

  approvePurchase(input: {
    purchaseId: string
    actorId: string
  }): PurchaseRecord {
    const actor = this.getUser(input.actorId)
    const purchase = this.getPurchases().find((p) => p.id === input.purchaseId)
    if (!actor || !purchase) throw new Error('找不到採購或操作者')
    if (purchase.status !== 'pending_approval') {
      throw new Error('此採購不在待核准狀態')
    }

    assertCanApprovePurchase({
      actorRole: actor.role,
      actorId: actor.id,
      requesterId: purchase.userId,
    })

    const updated: PurchaseRecord = {
      ...purchase,
      status: 'approved',
      approvedBy: actor.id,
      approvedAt: new Date().toISOString(),
    }
    this.savePurchase(updated)
    return updated
  },

  rejectPurchase(input: {
    purchaseId: string
    actorId: string
    reason: string
  }): PurchaseRecord {
    const actor = this.getUser(input.actorId)
    const purchase = this.getPurchases().find((p) => p.id === input.purchaseId)
    if (!actor || !purchase) throw new Error('找不到採購或操作者')
    if (purchase.status !== 'pending_approval') {
      throw new Error('此採購不在待核准狀態')
    }
    assertCanApprovePurchase({
      actorRole: actor.role,
      actorId: actor.id,
      requesterId: purchase.userId,
    })
    const trimmed = input.reason.trim()
    if (!trimmed) throw new Error('駁回必須填寫原因')

    const updated: PurchaseRecord = {
      ...purchase,
      status: 'rejected',
      rejectedReason: trimmed,
      approvedBy: actor.id,
      approvedAt: new Date().toISOString(),
    }
    this.savePurchase(updated)

    if (purchase.mode === 'emergency') {
      this.appendEmergencyEvent({
        id: `ele-${crypto.randomUUID()}`,
        organizationId: ORG_ID,
        employeeId: purchase.userId,
        businessDate: purchase.businessDate,
        type: 'RELEASE',
        amountDelta: -purchase.finalPayable,
        purchaseId: purchase.id,
        reason: `駁回釋放：${trimmed}`,
        createdAt: new Date().toISOString(),
        createdBy: actor.id,
      })
    }
    return updated
  },

  cancelEmergencyPurchase(input: {
    purchaseId: string
    actorId: string
    reason: string
  }): PurchaseRecord {
    const actor = this.getUser(input.actorId)
    const purchase = this.getPurchases().find((p) => p.id === input.purchaseId)
    if (!actor || !purchase) throw new Error('找不到採購或操作者')
    if (purchase.mode !== 'emergency') throw new Error('僅緊急採購可走額度釋放')
    if (purchase.status === 'cancelled') throw new Error('已取消')
    if (actor.role !== 'boss' && actor.id !== purchase.userId) {
      throw new Error('無權取消此緊急採購')
    }

    const updated: PurchaseRecord = {
      ...purchase,
      status: 'cancelled',
      rejectedReason: input.reason,
    }
    this.savePurchase(updated)

    // RELEASE against original businessDate (not cancel day) — REV-04
    this.appendEmergencyEvent({
      id: `ele-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      employeeId: purchase.userId,
      businessDate: purchase.businessDate,
      type: 'RELEASE',
      amountDelta: -purchase.finalPayable,
      purchaseId: purchase.id,
      reason: input.reason,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
    })

    return updated
  },

  getRepairCases(): RepairCase[] {
    return read(KEYS.repairCases, emptyRepairs)
  },

  getQuotations(): Quotation[] {
    return read(KEYS.quotations, emptyQuotes)
  },

  createQuotation(input: {
    createdBy: string
    title: string
    projectId?: string | null
    repairCaseId?: string | null
    taxMode: TaxMode
    amountBeforeTax: number
    taxRate?: number
  }): Quotation {
    assertQuoteAssociation(input)
    if (!input.taxMode) throw new Error('建立報價必須選擇稅務模式（REV-03）')

    const tax = calcQuoteTax({
      amountBeforeTax: input.amountBeforeTax,
      taxMode: input.taxMode,
      taxRate: input.taxRate,
    })

    const quote: Quotation = {
      id: `quo-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      projectId: input.projectId ?? null,
      repairCaseId: input.repairCaseId ?? null,
      title: input.title.trim(),
      status: 'draft',
      taxMode: input.taxMode,
      taxRate: tax.taxRate,
      amountBeforeTax: input.amountBeforeTax,
      taxAmount: tax.taxAmount,
      amountAfterTax: tax.amountAfterTax,
      frozen: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }
    const all = this.getQuotations()
    all.unshift(quote)
    write(KEYS.quotations, all)
    return quote
  },

  publishQuotation(quoteId: string): Quotation {
    const all = this.getQuotations()
    const idx = all.findIndex((q) => q.id === quoteId)
    if (idx < 0) throw new Error('找不到報價')
    const current = all[idx]
    if (!current.taxMode) throw new Error('發布前必須已有稅務模式')
    const published: Quotation = {
      ...current,
      status: 'published',
      frozen: true,
      publishedAt: new Date().toISOString(),
    }
    all[idx] = published
    write(KEYS.quotations, all)
    return published
  },

  getMaterials(): MaterialStock[] {
    return read(KEYS.materials, emptyMaterials)
  },

  inboundMaterial(input: {
    materialId: string
    qty: number
    unitCost: number
  }): MaterialStock {
    const all = this.getMaterials()
    const idx = all.findIndex((m) => m.id === input.materialId)
    if (idx < 0) throw new Error('找不到材料')
    const current = all[idx]
    const next = applyInboundMovingAverage({
      oldQty: current.qty,
      oldUnitCost: current.unitCost,
      inboundQty: input.qty,
      inboundUnitCost: input.unitCost,
    })
    const updated: MaterialStock = {
      ...current,
      qty: next.qty,
      unitCost: next.unitCost,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    write(KEYS.materials, all)
    return updated
  },

  getNotices(userId: string): AppNotice[] {
    return read(KEYS.notices, emptyNotices)
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  markNoticeRead(id: string) {
    const all = read(KEYS.notices, emptyNotices).map((n) =>
      n.id === id ? { ...n, unread: false } : n,
    )
    write(KEYS.notices, all)
  },

  completeNotice(id: string) {
    const all = read(KEYS.notices, emptyNotices).map((n) =>
      n.id === id ? { ...n, unread: false, status: 'done' as const } : n,
    )
    write(KEYS.notices, all)
  },

  getShortcutIds(): string[] {
    return read(KEYS.shortcuts, [
      'clock',
      'sites',
      'purchase',
      'quotes',
      'inventory',
      'todos',
      'team',
      'notices',
    ])
  },

  setShortcutIds(ids: string[]) {
    write(KEYS.shortcuts, ids)
  },
}
