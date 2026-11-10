export type UserRole = 'boss' | 'employee'

export type PayType = 'monthly' | 'daily' | 'hourly'

export type JobType = 'project' | 'repair' | 'purchase' | 'office' | 'other'

export type ProjectKind = 'formal' | 'repair'

export type ProjectStatus =
  | 'active'
  | 'pending_close'
  | 'closed'
  | 'warranty'

export type AttendanceStatus = 'clocked_in' | 'clocked_out'

export type PurchaseMode = 'normal' | 'emergency'

export type PurchaseStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'purchased'
  | 'rejected'
  | 'cancelled'

export type NoticeKind = 'notice' | 'todo'

export type NoticeStatus = 'open' | 'done' | 'cancelled'

export interface AppUser {
  id: string
  organizationId: string
  name: string
  role: UserRole
  email?: string
  phone?: string
  payType?: PayType
  lineUserId?: string | null
  financeAuthorized?: boolean
  createdAt: string
}

export interface SiteProject {
  id: string
  organizationId: string
  name: string
  kind: ProjectKind
  status: ProjectStatus
  address?: string
  customerName?: string
  notes?: string
  warrantyUntil?: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface AttendanceRecord {
  id: string
  organizationId: string
  userId: string
  status: AttendanceStatus
  clockInAt: string
  clockOutAt?: string | null
  siteId?: string | null
  jobType?: JobType | null
  latitude?: number | null
  longitude?: number | null
  note?: string | null
}

export interface PurchaseRecord {
  id: string
  organizationId: string
  userId: string
  siteId?: string | null
  mode: PurchaseMode
  status: PurchaseStatus
  title: string
  goodsAmount: number
  discount: number
  tax: number
  shipping: number
  otherBuyerFees: number
  finalPayable: number
  createdAt: string
  businessDate: string
}

export interface AppNotice {
  id: string
  organizationId: string
  userId: string
  kind: NoticeKind
  title: string
  detail: string
  status: NoticeStatus
  unread: boolean
  createdAt: string
  href?: string
}

export interface TeamPresence {
  userId: string
  name: string
  clockedIn: boolean
  siteName?: string | null
}

export interface PurchaseRuleSnapshot {
  preApprovalThresholdNtd: number
  emergencySingleLimitNtd: number
  emergencyDailyLimitNtd: number | null
}
