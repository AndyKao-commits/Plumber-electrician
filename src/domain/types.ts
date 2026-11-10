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

export type PhotoUploadStatus = 'pending' | 'linked' | 'discarded'

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
  approvedBy?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  inboundMaterialId?: string | null
  inboundQty?: number | null
  inboundAt?: string | null
}

export type TaxMode = 'inclusive' | 'exclusive' | 'zero'

export type QuoteStatus = 'draft' | 'published' | 'accepted' | 'void'

export interface RepairCase {
  id: string
  organizationId: string
  siteId?: string | null
  customerName: string
  title: string
  createdAt: string
}

export interface Quotation {
  id: string
  organizationId: string
  /** Exactly one of projectId / repairCaseId must be set (XOR). */
  projectId?: string | null
  repairCaseId?: string | null
  title: string
  status: QuoteStatus
  taxMode: TaxMode
  taxRate: number
  /** Derived from sum(quotation_items.amount) when items exist (FIN-02). */
  amountBeforeTax: number
  taxAmount: number
  amountAfterTax: number
  /** Frozen on publish */
  frozen?: boolean
  createdAt: string
  publishedAt?: string | null
  /** Customer acceptance after publish */
  acceptedAt?: string | null
  acceptedBy?: string | null
  acceptanceNote?: string | null
  createdBy: string
}

/** FIN-02: material / labor shown separately; amounts sum once into header. */
export type QuotationItemKind = 'material' | 'labor' | 'other'

export interface QuotationItem {
  id: string
  organizationId: string
  quotationId: string
  lineNo: number
  kind: QuotationItemKind
  description: string
  qty: number
  unit: string
  unitPrice: number
  amount: number
  createdAt: string
  updatedAt?: string
}

export interface MaterialStock {
  id: string
  organizationId: string
  name: string
  unit: string
  qty: number
  unitCost: number
  updatedAt: string
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

export interface PhotoUpload {
  id: string
  organizationId: string
  uploadedBy: string
  uploaderName?: string
  siteId?: string | null
  siteName?: string | null
  storagePath: string
  contentType?: string | null
  byteSize?: number | null
  source: string
  status: PhotoUploadStatus
  previewUrl?: string | null
  createdAt: string
}

export interface ConstructionReport {
  id: string
  organizationId: string
  siteId: string
  siteName?: string
  authorId: string
  authorName?: string
  body: string
  photoUploadId?: string | null
  photoPreviewUrl?: string | null
  createdAt: string
}

export type DefectSeverity = 'normal' | 'safety'
export type DefectStatus = 'open' | 'fixed' | 'reinspected' | 'closed'

export interface SiteDefect {
  id: string
  organizationId: string
  siteId: string
  reportedBy: string
  reporterName?: string
  title: string
  detail: string
  severity: DefectSeverity
  status: DefectStatus
  fixedAt?: string | null
  fixedNote?: string | null
  reinspectedAt?: string | null
  reinspectNote?: string | null
  closedAt?: string | null
  createdAt: string
}
