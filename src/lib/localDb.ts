import type {
  AppNotice,
  AppUser,
  AttendanceRecord,
  PurchaseRecord,
  SiteProject,
} from '@/domain/types'
import { calcFinalPayable } from '@/domain/rules'
import { formatTaipei } from '@/lib/time'

const ORG_ID = 'org-demo'

const KEYS = {
  sessionUserId: 'eg.sessionUserId',
  users: 'eg.users.v2',
  sites: 'eg.sites.v2',
  attendance: 'eg.attendance.v2',
  purchases: 'eg.purchases.v1',
  notices: 'eg.notices.v1',
  shortcuts: 'eg.shortcuts.v1',
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

  write(KEYS.users, seededUsers)
  write(KEYS.sites, seededSites)
  write(KEYS.attendance, emptyAttendance)
  write(KEYS.purchases, emptyPurchases)
  write(KEYS.notices, seededNotices)
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

  emergencyUsedToday(userId: string, businessDate = formatTaipei(new Date(), 'yyyy-MM-dd')) {
    return this.getPurchases()
      .filter(
        (p) =>
          p.userId === userId &&
          p.mode === 'emergency' &&
          p.businessDate === businessDate &&
          p.status !== 'cancelled' &&
          p.status !== 'rejected',
      )
      .reduce((sum, p) => sum + p.finalPayable, 0)
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
    const needsApproval =
      input.mode === 'normal' && finalPayable >= 3000
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
      businessDate: formatTaipei(new Date(), 'yyyy-MM-dd'),
    }
    this.savePurchase(record)
    return record
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
      'todos',
      'team',
      'notices',
    ])
  },

  setShortcutIds(ids: string[]) {
    write(KEYS.shortcuts, ids)
  },
}
