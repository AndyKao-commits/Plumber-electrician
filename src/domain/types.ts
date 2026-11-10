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

export interface AppUser {
  id: string
  name: string
  role: UserRole
  email?: string
  phone?: string
  payType?: PayType
  lineUserId?: string | null
  createdAt: string
}

export interface SiteProject {
  id: string
  name: string
  kind: ProjectKind
  status: ProjectStatus
  address?: string
  customerName?: string
  notes?: string
  warrantyUntil?: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecord {
  id: string
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

export interface PurchaseRuleSnapshot {
  preApprovalThresholdNtd: number
  emergencySingleLimitNtd: number
  emergencyDailyLimitNtd: number | null
}
