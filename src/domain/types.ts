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
  /** V1.0 profile */
  nickname?: string | null
  birthDate?: string | null
  jobTitle?: string | null
  hiredAt?: string | null
  accountStatus?: 'active' | 'disabled'
  notes?: string | null
  payType?: PayType
  lineUserId?: string | null
  financeAuthorized?: boolean
  createdAt: string
}

export type ExpenseReportStatus =
  | 'pending_review'
  | 'confirmed'
  | 'returned'
  | 'cancelled'

export type CashReceiptStatus =
  | 'pending_confirm'
  | 'confirmed'
  | 'returned'
  | 'cancelled'

/** V1.0 employee expense report (awaiting boss review). */
export interface ExpenseReport {
  id: string
  organizationId: string
  /** Null = misc (加油／餐飲等)，不掛案件 */
  siteId: string | null
  siteName: string
  /** Free-text place when misc / optional note for site spend */
  locationText?: string | null
  item: string
  amount: number
  note?: string | null
  receiptPhotoPath?: string | null
  status: ExpenseReportStatus
  reportedBy: string
  reportedByName: string
  reportedAt: string
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNote?: string | null
}

/** V1.0 cash receipt report (awaiting boss confirm). */
export interface CashReceiptReport {
  id: string
  organizationId: string
  siteId: string | null
  siteName: string
  locationText?: string | null
  amount: number
  sourceNote?: string | null
  proofPhotoPath?: string | null
  status: CashReceiptStatus
  reportedBy: string
  reportedByName: string
  reportedAt: string
  confirmedBy?: string | null
  confirmedAt?: string | null
  confirmNote?: string | null
}

export interface AuditLogEntry {
  id: string
  organizationId: string
  action: string
  actorId: string
  actorName: string
  targetType: string
  targetId: string
  beforeJson?: string | null
  afterJson?: string | null
  result: 'ok' | 'error'
  message?: string | null
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
  /** SUP-001 optional supplier link. */
  supplierId?: string | null
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
  /** Supplier payment confirmation (AP cleared). */
  paidAt?: string | null
}

/** SUP-001 supplier master. */
export interface Supplier {
  id: string
  organizationId: string
  name: string
  /** null / ≤0 = no credit limit configured (do not invent). */
  creditLimit: number | null
  paymentTermsDays: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface SupplierExposure {
  supplierId: string
  unpaidPayable: number
  openCommitment: number
  exposure: number
  availableCredit: number | null
}

export type TaxMode = 'inclusive' | 'exclusive' | 'zero'

/** Legacy DB enum — kept for column compatibility; prefer workflowStatus. */
export type QuoteStatus = 'draft' | 'published' | 'void'

/**
 * Case-centric quote workflow (primary UI status).
 * Only `accepted` counts toward effective contract amount.
 */
export type QuoteWorkflowStatus =
  | 'editing'
  | 'exported'
  | 'sent_to_customer'
  | 'accepted'
  | 'rejected'
  | 'cancelled'

/** REP-001 repair workflow status. */
export type RepairCaseStatus =
  | 'pending_schedule'
  | 'scheduled'
  | 'in_progress'
  | 'pending_confirm'
  | 'closed'
  | 'paused'
  | 'cancelled'

export interface RepairCase {
  id: string
  organizationId: string
  caseNumber: string
  /** Business-required (REP-01). */
  problemDescription: string
  /** Display alias; defaults to problemDescription. */
  title: string
  status: RepairCaseStatus
  siteId?: string | null
  customerId?: string | null
  /** Free-text name when no customer master linked. */
  customerName?: string | null
  createdAt: string
  updatedAt?: string
  createdBy?: string | null
}

/** REP-001: dispatch / assignment history (immutable rows). */
export interface RepairAssignment {
  id: string
  organizationId: string
  repairCaseId: string
  assigneeUserId: string
  assigneeName: string
  note?: string | null
  assignedAt: string
  createdBy: string
}

/**
 * REP-001 / REP-03: visit history. Must NOT create attendance.
 */
export interface RepairVisit {
  id: string
  organizationId: string
  repairCaseId: string
  visitorUserId: string
  visitorName: string
  note?: string | null
  visitedAt: string
  createdBy: string
  /** Always false — documented invariant. */
  attendanceCreated: false
}

/** WAR-001 warranty master (period/scope — not auto-free). */
export interface Warranty {
  id: string
  organizationId: string
  title: string
  siteId?: string | null
  repairCaseId?: string | null
  startsOn?: string | null
  endsOn?: string | null
  scopeNotes?: string | null
  exclusionNotes?: string | null
  createdAt: string
  createdBy: string
}

export type WarrantyAssessmentClassification =
  | 'covered'
  | 'partial'
  | 'excluded'
  | 'out_of_period'
  | 'not_warranty'

export interface WarrantyAssessment {
  id: string
  organizationId: string
  repairCaseId: string
  warrantyId?: string | null
  classification: WarrantyAssessmentClassification
  rationale: string
  assessedAt: string
  assessedBy: string
  assessedByName: string
}

/** COM-001 complaint — may exist without project linkage. */
export type ComplaintStatus =
  | 'open'
  | 'investigating'
  | 'escalated'
  | 'resolved'
  | 'closed'

export interface Complaint {
  id: string
  organizationId: string
  subject: string
  detail?: string | null
  status: ComplaintStatus
  siteId?: string | null
  repairCaseId?: string | null
  customerName?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

/** Association only — does not merge/delete repair cases. */
export interface RelatedRepairCase {
  id: string
  organizationId: string
  fromRepairCaseId: string
  toRepairCaseId: string
  note?: string | null
  createdAt: string
  createdBy: string
}

/** CRM-001: customer master — name is the only required field. */
export interface Customer {
  id: string
  organizationId: string
  name: string
  phone?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
}

export interface CustomerContact {
  id: string
  organizationId: string
  customerId: string
  name: string
  phone?: string | null
  email?: string | null
  isPrimary: boolean
  notes?: string | null
  createdAt: string
}

/** Many-to-many: multiple customers may share one site/address. */
export interface CustomerSiteLink {
  id: string
  organizationId: string
  customerId: string
  siteId: string
  createdAt: string
}

export interface Quotation {
  id: string
  organizationId: string
  /** Exactly one of projectId / repairCaseId must be set (XOR). */
  projectId?: string | null
  repairCaseId?: string | null
  title: string
  /** @deprecated use workflowStatus */
  status: QuoteStatus
  workflowStatus: QuoteWorkflowStatus
  quoteNumber: string
  customerName: string
  siteAddress: string
  taxMode: TaxMode
  taxRate: number
  /** Subtotal from items (before discount). */
  amountBeforeTax: number
  discount: number
  taxAmount: number
  amountAfterTax: number
  notes?: string | null
  constructionNotes?: string | null
  customerPhone?: string | null
  paymentTerms?: string | null
  validUntil?: string | null
  currentVersion: number
  lastExportedAt?: string | null
  /** Legacy; versions are the real freeze boundary. */
  frozen?: boolean
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  createdBy: string
  deletedAt?: string | null
  deletedBy?: string | null
  deleteReason?: string | null
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

export type QuoteExportFormat = 'snapshot' | 'pdf' | 'csv' | 'print'

export interface QuotationVersion {
  id: string
  organizationId: string
  quotationId: string
  versionNo: number
  quoteNumber: string
  snapshot: QuoteExportSnapshot
  exportedAt: string
  exportedBy?: string | null
  exportFormat: QuoteExportFormat
  deletedAt?: string | null
  deletedBy?: string | null
  deleteReason?: string | null
}

export interface QuoteExportSnapshot {
  quoteNumber: string
  versionNo: number
  quoteDate: string
  title: string
  customerName: string
  siteAddress: string
  taxMode: TaxMode
  taxRate: number
  items: Array<{
    lineNo: number
    kind: QuotationItemKind
    description: string
    qty: number
    unit: string
    unitPrice: number
    amount: number
  }>
  subtotal: number
  discount: number
  taxAmount: number
  total: number
  paymentTerms: string
  validUntil: string | null
  notes: string
}

/** FIN-002: 追加／追減；僅 accepted 計入有效合約。 */
export type ChangeOrderKind = 'addition' | 'reduction'

export type ChangeOrderStatus =
  | 'draft'
  | 'sent_to_customer'
  | 'accepted'
  | 'rejected'
  | 'cancelled'

export interface ChangeOrder {
  id: string
  organizationId: string
  quotationId: string
  changeNumber: string
  kind: ChangeOrderKind
  title: string
  status: ChangeOrderStatus
  taxMode: TaxMode
  taxRate: number
  amountBeforeTax: number
  discount: number
  taxAmount: number
  amountAfterTax: number
  notes?: string | null
  acceptedAt?: string | null
  acceptedBy?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface ChangeOrderItem {
  id: string
  organizationId: string
  changeOrderId: string
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

/** FIN-003: 請款節點（分期）。 */
export type BillingMilestoneStatus = 'planned' | 'billed' | 'cancelled'

export interface BillingMilestone {
  id: string
  organizationId: string
  quotationId: string
  code: string
  title: string
  sequence: number
  plannedAmount: number
  status: BillingMilestoneStatus
  createdAt: string
  updatedAt: string
  createdBy: string
}

/** 請款單 ≠ 法定統一發票 ≠ 收款 ≠ 會計收入。 */
export type BillingDocumentStatus = 'draft' | 'issued' | 'void'

export interface BillingDocument {
  id: string
  organizationId: string
  quotationId: string
  milestoneId: string
  documentNumber: string
  title: string
  status: BillingDocumentStatus
  taxMode: TaxMode
  taxRate: number
  amountBeforeTax: number
  taxAmount: number
  amountAfterTax: number
  notes?: string | null
  /** Frozen payload when issued. */
  snapshot?: BillingDocumentSnapshot | null
  issuedAt?: string | null
  issuedBy?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface BillingDocumentItem {
  id: string
  organizationId: string
  billingDocumentId: string
  lineNo: number
  description: string
  qty: number
  unit: string
  unitPrice: number
  amount: number
  createdAt: string
}

export interface BillingDocumentSnapshot {
  documentNumber: string
  milestoneCode: string
  milestoneTitle: string
  quoteNumber: string
  title: string
  customerName: string
  issuedAt: string
  taxMode: TaxMode
  taxRate: number
  items: Array<{
    lineNo: number
    description: string
    qty: number
    unit: string
    unitPrice: number
    amount: number
  }>
  amountBeforeTax: number
  taxAmount: number
  amountAfterTax: number
  notes: string
}

/** FIN-004: 實際收款（現金流）≠ 請款 ≠ 會計收入。 */
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'other'
export type PaymentStatus = 'confirmed' | 'void'

export interface CustomerPayment {
  id: string
  organizationId: string
  quotationId: string
  paymentNumber: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  receivedAt: string
  notes?: string | null
  createdAt: string
  createdBy: string
}

export interface PaymentAllocation {
  id: string
  organizationId: string
  paymentId: string
  billingDocumentId: string
  amount: number
  createdAt: string
  createdBy: string
}

export type CustomerAdvanceStatus = 'open' | 'closed' | 'void'

export interface CustomerAdvance {
  id: string
  organizationId: string
  quotationId: string
  advanceNumber: string
  amount: number
  remainingAmount: number
  status: CustomerAdvanceStatus
  receivedAt: string
  notes?: string | null
  createdAt: string
  createdBy: string
}

/** 預收抵充：不新增現金流入。 */
export interface AdvanceApplication {
  id: string
  organizationId: string
  advanceId: string
  billingDocumentId: string
  amount: number
  createdAt: string
  createdBy: string
}

/** FIN-005: 折讓（減應收，非現金流出）。 */
export type CustomerCreditNoteStatus = 'issued' | 'void'

export interface CustomerCreditNote {
  id: string
  organizationId: string
  quotationId: string
  billingDocumentId?: string | null
  creditNumber: string
  amount: number
  reason: string
  status: CustomerCreditNoteStatus
  issuedAt: string
  createdAt: string
  createdBy: string
}

/** FIN-005: 退款（現金流出；保留原收款紀錄）。 */
export type CustomerRefundStatus = 'confirmed' | 'void'

export interface CustomerRefund {
  id: string
  organizationId: string
  quotationId: string
  paymentId: string
  refundNumber: string
  amount: number
  method: PaymentMethod
  status: CustomerRefundStatus
  reason: string
  refundedAt: string
  createdAt: string
  createdBy: string
}

/**
 * FIN-006: 已確認營運成本（≠ 薪資自動認列 ≠ 會計收入）。
 * 免費保固仍可登錄成本（warrantyFree）；客戶收費可為 0。
 */
export type OperatingCostKind = 'material' | 'labor_ops' | 'other'
export type OperatingCostStatus = 'confirmed' | 'void'

export interface CaseOperatingCost {
  id: string
  organizationId: string
  quotationId: string
  kind: OperatingCostKind
  description: string
  amount: number
  status: OperatingCostStatus
  warrantyFree: boolean
  confirmedAt: string
  createdAt: string
  createdBy: string
}

export type MaterialTrackingMode = 'quantity' | 'serial'

export type PettyCashRequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'disbursed'

/** PET-001: custodian petty cash account. */
export interface PettyCashAccount {
  id: string
  organizationId: string
  custodianUserId: string
  label: string
  balance: number
  updatedAt: string
}

export interface PettyCashTopUpRequest {
  id: string
  organizationId: string
  accountId: string
  amount: number
  reason: string
  status: PettyCashRequestStatus
  requestedBy: string
  requestedAt: string
  approvedBy?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  disbursementId?: string | null
}

export interface PettyCashDisbursement {
  id: string
  organizationId: string
  requestId: string
  accountId: string
  amount: number
  disbursedBy: string
  disbursedAt: string
  note?: string | null
}

export interface PettyCashLedgerEntry {
  id: string
  organizationId: string
  accountId: string
  entryType: 'top_up' | 'expense' | 'adjust'
  amount: number
  balanceAfter: number
  sourceType: 'disbursement' | 'manual'
  sourceId: string
  note?: string | null
  postedAt: string
  createdBy: string
}

export interface MaterialStock {
  id: string
  organizationId: string
  name: string
  unit: string
  qty: number
  unitCost: number
  /** INV-001: org-unique SKU */
  sku?: string
  trackingMode?: MaterialTrackingMode
  baseUnitCode?: string
  /** Active reservations against org pool (INV-002). */
  reservedQty?: number
  /** qty − reservedQty */
  availableQty?: number
  updatedAt: string
}

/** INV-001: alternate units with factor to base. */
export interface MaterialUnit {
  id: string
  organizationId: string
  materialId: string
  code: string
  label: string
  factorToBase: number
  isBase: boolean
}

/** INV-001: org-unique serial for serial-tracked materials. */
export interface MaterialSerial {
  id: string
  organizationId: string
  materialId: string
  serialNumber: string
  status: 'in_stock' | 'issued' | 'scrapped'
  unitCost: number
  locationId?: string | null
  createdAt: string
  createdBy: string
}

export type StockLocationKind = 'warehouse' | 'site'
export type StockMovementType =
  | 'inbound'
  | 'transfer'
  | 'reserve'
  | 'release'
  | 'usage'
  | 'adjust'
  | 'reversal'
export type StockReservationStatus = 'active' | 'released' | 'consumed'

/** INV-002: warehouse or site stock location. */
export interface StockLocation {
  id: string
  organizationId: string
  kind: StockLocationKind
  name: string
  siteId?: string | null
  isDefault?: boolean
  createdAt: string
}

/** Per-location on-hand (org cost pool stays on MaterialStock). */
export interface StockBalance {
  id: string
  organizationId: string
  materialId: string
  locationId: string
  qty: number
  updatedAt: string
}

/** Append-only posted stock movement (immutable). */
export interface StockMovement {
  id: string
  organizationId: string
  movementType: StockMovementType
  materialId: string
  materialName: string
  qty: number
  unitCost: number
  fromLocationId?: string | null
  toLocationId?: string | null
  reservationId?: string | null
  note?: string | null
  clientOperationId: string
  postedAt: string
  createdBy: string
  reversalOf?: string | null
}

export interface StockReservation {
  id: string
  organizationId: string
  materialId: string
  locationId?: string | null
  qty: number
  status: StockReservationStatus
  note?: string | null
  clientOperationId: string
  createdAt: string
  createdBy: string
  releasedAt?: string | null
}

/**
 * REP-002: formal material usage (shared ledger). Deducts once; snapshots unit cost.
 * Free/warranty repairs still record cost here.
 */
export interface MaterialUsage {
  id: string
  organizationId: string
  materialId: string
  materialName: string
  qty: number
  unitCost: number
  totalCost: number
  repairCaseId?: string | null
  siteId?: string | null
  note?: string | null
  clientOperationId: string
  postedAt: string
  createdBy: string
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

export type PhotoType =
  | 'before'
  | 'during'
  | 'after'
  | 'acceptance'
  | 'unclassified'

export interface PhotoUpload {
  id: string
  organizationId: string
  uploadedBy: string
  uploaderName?: string
  siteId?: string | null
  siteName?: string | null
  photoType?: PhotoType | null
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
