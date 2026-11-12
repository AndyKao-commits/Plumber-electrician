import {
  assertCanApproveAttendanceCorrection,
  assertCanApprovePurchase,
  assertCanExportQuote,
  assertCanMarkQuoteAccept,
  assertPermission,
  assertSameOrganization,
  hasPermission,
  PERMISSIONS,
} from '@/domain/permissions'
import { isUuid, optionalUuid, requireUuid } from '@/lib/ids'
import { safeNotify, safeNotifyApprovers } from '@/lib/lineNotify'
import {
  assertEmergencyReserveAllowed,
  sumOccupiedQuota,
} from '@/domain/emergencyLimits'
import { applyInboundMovingAverage } from '@/domain/inventoryCost'
import {
  assertQuoteAssociation,
  assertQuoteDraftEditable,
  calcFinalPayable,
  calcQuoteItemAmount,
} from '@/domain/rules'
import {
  assertSpendSettingsInput,
  assertWithinDailyPurchaseLimit,
  defaultOrgSpendSettings,
  requiresBossReview,
  type OrgSpendSettings,
} from '@/domain/orgSpendSettings'
import { assertPhotoType } from '@/domain/photoTypes'
import { assertCanAccessSite, filterSitesByAccess } from '@/domain/siteAccess'
import { assertFeature } from '@/domain/featureAccess'
import {
  assertSiteStatus,
  assertSiteStatusTransition,
} from '@/domain/siteStatus'
import {
  buildSiteDeleteImpact,
  deletedSiteFinanceLabel,
} from '@/domain/siteDeleteImpact'
import {
  templateToAccessFields,
  withNormalizedFeatures,
} from '@/domain/roleGroups'
import {
  assertAccountStatus,
  normalizeProfileFields,
  normalizeProfileName,
} from '@/domain/profileFields'
import { accountToAuthEmail } from '@/domain/loginIdentity'
import {
  assertBillingDocumentEditable,
  assertCanManageBilling,
  assertIssueDoesNotExceedContract,
  buildBillingSnapshot,
  calcBillingTotals,
  canCreateBillingForQuote,
  sumIssuedBillingAmount,
} from '@/domain/billing'
import {
  assertAdvanceApplicationFits,
  assertAllocationFits,
  assertCanManagePayments,
  billingDocumentOpenAmount,
  canRecordPaymentForQuote,
  sumAllocations,
} from '@/domain/payments'
import {
  assertCanManageRefunds,
  assertCreditNoteFits,
  assertRefundFits,
  canIssueCreditOrRefund,
  refundsOnPayment,
  sumIssuedCredits,
} from '@/domain/refunds'
import {
  assertCanRecordOperatingCost,
  assertOperatingCostAmount,
} from '@/domain/financeSummary'
import {
  assertCanLinkCustomerToSite,
  assertContactName,
  assertCustomerName,
} from '@/domain/crm'
import {
  assertProblemDescription,
  nextRepairStatusAfterDispatch,
  nextRepairStatusAfterVisit,
  visitCreatesAttendance,
} from '@/domain/repairs'
import {
  assertWarrantyAssessmentRationale,
  isAutoFreeByWarrantyDates,
} from '@/domain/warranty'
import {
  assertComplaintSubject,
  assertDistinctRelatedCases,
  assertRelatedCasesAreAssociationOnly,
} from '@/domain/complaints'
import {
  assertNoNegativeStock,
  assertUsageNotAlreadyPosted,
  assertUsageQty,
  computeUsageCost,
} from '@/domain/materialUsage'
import {
  assertAvailableForConsume,
  assertPositiveQty,
  assertReservationRelease,
  assertTransferDoesNotAffectCost,
} from '@/domain/stockLedger'
import {
  assertSerialUniqueInOrg,
  assertSkuUniqueInOrg,
  assertUnitFactor,
  convertMaterialQty,
} from '@/domain/materialMaster'
import {
  applyDisbursementCredit,
  assertApproveDoesNotCreditBalance,
  assertCanApprove,
  assertCanDisburse,
  assertCanRequest,
  assertRequestApprovable,
  assertRequestDisbursable,
  assertTopUpAmount,
} from '@/domain/pettyCash'
import {
  assertSupplierName,
  assertWithinCreditLimit,
  sumSupplierExposure,
} from '@/domain/suppliers'
import {
  assertBossCancelFinance,
  assertBossFinalize,
  assertCanCancelExpense,
  assertCanCancelReceipt,
  assertCanConfirmReceipt,
  assertCanReviewExpense,
  assertExpenseItem,
  assertPositiveMoney,
  resolveFieldCashTarget,
} from '@/domain/fieldFinance'
import {
  assertAdvanceItem,
  assertCanCancelAdvance,
  assertCanSettleAdvances,
  buildSettleExpenseItem,
} from '@/domain/employeeAdvances'
import {
  assertBossSalaryAction,
  assertCorrectionReason,
  assertPayType,
  assertSalaryAmount,
  assertSalaryCategory,
  canConfirmSalaryEntry,
  canMarkSalaryPaid,
  periodFromDate,
} from '@/domain/salary'
import { type AuditAction } from '@/domain/auditLog'
import { roundMoney } from '@/domain/money'
import {
  assertCanMarkChangeOrderAccept,
  assertChangeOrderEditable,
  canCreateChangeOrder,
  effectiveContractAmountWithChangeOrders,
} from '@/domain/changeOrders'
import {
  assertCanSoftDeleteQuoteCase,
  assertCanSoftDeleteQuoteVersion,
} from '@/domain/quoteDelete'
import {
  buildQuoteExportSnapshot,
  legacyStatusFromWorkflow,
  workflowFromLegacy,
} from '@/domain/quoteWorkflow'
import type {
  AdvanceApplication,
  AppNotice,
  AppUser,
  AttendanceCorrection,
  AttendanceRecord,
  LocationCheckin,
  DailyLog,
  DailyLogSummary,
  DailyLogVersion,
  BillingDocument,
  BillingDocumentItem,
  BillingDocumentSnapshot,
  BillingMilestone,
  ChangeOrder,
  ChangeOrderItem,
  ChangeOrderKind,
  ChangeOrderStatus,
  CustomerAdvance,
  CaseOperatingCost,
  Customer,
  CustomerContact,
  CustomerCreditNote,
  CustomerPayment,
  CustomerRefund,
  CustomerSiteLink,
  OperatingCostKind,
  MaterialSerial,
  MaterialStock,
  MaterialUnit,
  MaterialUsage,
  PettyCashAccount,
  PettyCashDisbursement,
  PettyCashLedgerEntry,
  PettyCashTopUpRequest,
  Supplier,
  StockBalance,
  ExpenseReport,
  EmployeeAdvance,
  EmployeePaySetting,
  SalaryEntry,
  SalaryEntryCategory,
  SalaryEntryStatus,
  CashReceiptReport,
  AuditLogEntry,
  PayType,
  StockLocation,
  StockMovement,
  StockReservation,
  PaymentAllocation,
  PaymentMethod,
  PurchaseMode,
  PurchaseRecord,
  ConstructionReport,
  DefectSeverity,
  PhotoUpload,
  Quotation,
  QuotationItem,
  QuotationItemKind,
  QuotationVersion,
  QuoteExportFormat,
  QuoteExportSnapshot,
  QuoteWorkflowStatus,
  RepairAssignment,
  RepairCase,
  RepairCaseStatus,
  RepairVisit,
  SiteDefect,
  SiteProject,
  TaxMode,
  Complaint,
  ComplaintStatus,
  RelatedRepairCase,
  Warranty,
  WarrantyAssessment,
  WarrantyAssessmentClassification,
  TeamPresence,
  UserRole,
} from '@/domain/types'
import { AppError, toUserMessage } from '@/lib/errors'
import { formatTaipei, taipeiDateString } from '@/lib/time'
import { supabase } from '@/lib/supabase'

function sb() {
  if (!supabase) throw new AppError('尚未設定 Supabase，無法使用正式模式')
  return supabase
}

const QUOTE_SELECT =
  'id, organization_id, project_id, repair_case_id, title, status, workflow_status, quote_number, customer_name, customer_phone, site_address, tax_mode, tax_rate, amount_before_tax, discount, tax_amount, amount_after_tax, notes, construction_notes, payment_terms, valid_until, current_version, last_exported_at, frozen, created_at, updated_at, published_at, created_by, deleted_at, deleted_by, delete_reason'

function mapQuotationRow(row: Record<string, unknown>): Quotation {
  const status = row.status as Quotation['status']
  const workflowStatus = workflowFromLegacy(
    status,
    row.workflow_status as string | null,
  )
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    projectId: (row.project_id as string | null) ?? null,
    repairCaseId: (row.repair_case_id as string | null) ?? null,
    title: String(row.title),
    status,
    workflowStatus,
    quoteNumber:
      String(row.quote_number || '') ||
      `Q-${String(row.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    customerName: String(row.customer_name || ''),
    customerPhone: (row.customer_phone as string | null) ?? null,
    siteAddress: String(row.site_address || ''),
    taxMode: row.tax_mode as TaxMode,
    taxRate: Number(row.tax_rate),
    amountBeforeTax: Number(row.amount_before_tax),
    discount: Number(row.discount ?? 0) || 0,
    taxAmount: Number(row.tax_amount),
    amountAfterTax: Number(row.amount_after_tax),
    notes: (row.notes as string | null) ?? null,
    constructionNotes: (row.construction_notes as string | null) ?? null,
    paymentTerms: (row.payment_terms as string | null) ?? '依約定',
    validUntil: (row.valid_until as string | null) ?? null,
    currentVersion: Number(row.current_version ?? 0) || 0,
    lastExportedAt: (row.last_exported_at as string | null) ?? null,
    frozen: Boolean(row.frozen),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
    publishedAt: (row.published_at as string | null) ?? null,
    createdBy: String(row.created_by ?? ''),
    deletedAt: (row.deleted_at as string | null) ?? null,
    deletedBy: (row.deleted_by as string | null) ?? null,
    deleteReason: (row.delete_reason as string | null) ?? null,
  }
}

function mapChangeOrderRow(row: Record<string, unknown>): ChangeOrder {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    changeNumber: String(row.change_number),
    kind: row.kind as ChangeOrderKind,
    title: String(row.title),
    status: row.status as ChangeOrderStatus,
    taxMode: row.tax_mode as TaxMode,
    taxRate: Number(row.tax_rate),
    amountBeforeTax: Number(row.amount_before_tax),
    discount: Number(row.discount ?? 0) || 0,
    taxAmount: Number(row.tax_amount),
    amountAfterTax: Number(row.amount_after_tax),
    notes: (row.notes as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    acceptedBy: (row.accepted_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapChangeOrderItemRow(row: Record<string, unknown>): ChangeOrderItem {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    changeOrderId: String(row.change_order_id),
    lineNo: Number(row.line_no),
    kind: row.kind as QuotationItemKind,
    description: String(row.description),
    qty: Number(row.qty),
    unit: String(row.unit),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }
}

const BILLING_MILESTONE_SELECT =
  'id, organization_id, quotation_id, code, title, sequence, planned_amount, status, created_at, updated_at, created_by'

const BILLING_DOC_SELECT =
  'id, organization_id, quotation_id, milestone_id, document_number, title, status, tax_mode, tax_rate, amount_before_tax, tax_amount, amount_after_tax, notes, snapshot, issued_at, issued_by, created_at, updated_at, created_by'

function mapBillingMilestoneRow(row: Record<string, unknown>): BillingMilestone {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    code: String(row.code),
    title: String(row.title),
    sequence: Number(row.sequence),
    plannedAmount: Number(row.planned_amount),
    status: row.status as BillingMilestone['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapBillingDocumentRow(row: Record<string, unknown>): BillingDocument {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    milestoneId: String(row.milestone_id),
    documentNumber: String(row.document_number),
    title: String(row.title),
    status: row.status as BillingDocument['status'],
    taxMode: row.tax_mode as TaxMode,
    taxRate: Number(row.tax_rate),
    amountBeforeTax: Number(row.amount_before_tax),
    taxAmount: Number(row.tax_amount),
    amountAfterTax: Number(row.amount_after_tax),
    notes: (row.notes as string | null) ?? null,
    snapshot: (row.snapshot as BillingDocumentSnapshot | null) ?? null,
    issuedAt: (row.issued_at as string | null) ?? null,
    issuedBy: (row.issued_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapBillingDocumentItemRow(
  row: Record<string, unknown>,
): BillingDocumentItem {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    billingDocumentId: String(row.billing_document_id),
    lineNo: Number(row.line_no),
    description: String(row.description),
    qty: Number(row.qty),
    unit: String(row.unit),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    createdAt: String(row.created_at),
  }
}

function mapCustomerPaymentRow(row: Record<string, unknown>): CustomerPayment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    paymentNumber: String(row.payment_number),
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    status: row.status as CustomerPayment['status'],
    receivedAt: String(row.received_at),
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapPaymentAllocationRow(
  row: Record<string, unknown>,
): PaymentAllocation {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    paymentId: String(row.payment_id),
    billingDocumentId: String(row.billing_document_id),
    amount: Number(row.amount),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapCustomerAdvanceRow(row: Record<string, unknown>): CustomerAdvance {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    advanceNumber: String(row.advance_number),
    amount: Number(row.amount),
    remainingAmount: Number(row.remaining_amount),
    status: row.status as CustomerAdvance['status'],
    receivedAt: String(row.received_at),
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapAdvanceApplicationRow(
  row: Record<string, unknown>,
): AdvanceApplication {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    advanceId: String(row.advance_id),
    billingDocumentId: String(row.billing_document_id),
    amount: Number(row.amount),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapCustomerCreditNoteRow(
  row: Record<string, unknown>,
): CustomerCreditNote {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    billingDocumentId: (row.billing_document_id as string | null) ?? null,
    creditNumber: String(row.credit_number),
    amount: Number(row.amount),
    reason: String(row.reason),
    status: row.status as CustomerCreditNote['status'],
    issuedAt: String(row.issued_at),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapCustomerRefundRow(row: Record<string, unknown>): CustomerRefund {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    paymentId: String(row.payment_id),
    refundNumber: String(row.refund_number),
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    status: row.status as CustomerRefund['status'],
    reason: String(row.reason),
    refundedAt: String(row.refunded_at),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapCaseOperatingCostRow(
  row: Record<string, unknown>,
): CaseOperatingCost {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    kind: row.kind as OperatingCostKind,
    description: String(row.description),
    amount: Number(row.amount),
    status: row.status as CaseOperatingCost['status'],
    warrantyFree: Boolean(row.warranty_free),
    confirmedAt: String(row.confirmed_at),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapCustomerRow(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: (row.created_by as string | null) ?? null,
  }
}

function mapCustomerContactRow(row: Record<string, unknown>): CustomerContact {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    customerId: String(row.customer_id),
    name: String(row.name),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    isPrimary: Boolean(row.is_primary),
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

function mapCustomerSiteLinkRow(
  row: Record<string, unknown>,
): CustomerSiteLink {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    customerId: String(row.customer_id),
    siteId: String(row.site_id),
    createdAt: String(row.created_at),
  }
}

function mapRepairCaseRow(row: Record<string, unknown>): RepairCase {
  const problem =
    String(row.problem_description || row.title || '').trim() || '（未填問題）'
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    caseNumber: String(row.case_number || `RC-${String(row.id).slice(0, 8)}`),
    problemDescription: problem,
    title: String(row.title || problem),
    status: (row.status as RepairCaseStatus) || 'pending_schedule',
    siteId: (row.site_id as string | null) ?? null,
    customerId: (row.customer_id as string | null) ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: (row.updated_at as string | null) ?? String(row.created_at),
    createdBy: (row.created_by as string | null) ?? null,
  }
}

function mapRepairAssignmentRow(
  row: Record<string, unknown>,
): RepairAssignment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    repairCaseId: String(row.repair_case_id),
    assigneeUserId: String(row.assignee_user_id),
    assigneeName: String(row.assignee_name),
    note: (row.note as string | null) ?? null,
    assignedAt: String(row.assigned_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapRepairVisitRow(row: Record<string, unknown>): RepairVisit {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    repairCaseId: String(row.repair_case_id),
    visitorUserId: String(row.visitor_user_id),
    visitorName: String(row.visitor_name),
    note: (row.note as string | null) ?? null,
    visitedAt: String(row.visited_at),
    createdBy: String(row.created_by ?? ''),
    attendanceCreated: false,
  }
}

function mapWarrantyRow(row: Record<string, unknown>): Warranty {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    title: String(row.title),
    siteId: (row.site_id as string | null) ?? null,
    repairCaseId: (row.repair_case_id as string | null) ?? null,
    startsOn: (row.starts_on as string | null) ?? null,
    endsOn: (row.ends_on as string | null) ?? null,
    scopeNotes: (row.scope_notes as string | null) ?? null,
    exclusionNotes: (row.exclusion_notes as string | null) ?? null,
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapWarrantyAssessmentRow(
  row: Record<string, unknown>,
): WarrantyAssessment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    repairCaseId: String(row.repair_case_id),
    warrantyId: (row.warranty_id as string | null) ?? null,
    classification: row.classification as WarrantyAssessmentClassification,
    rationale: String(row.rationale),
    assessedAt: String(row.assessed_at),
    assessedBy: String(row.assessed_by),
    assessedByName: String(row.assessed_by_name),
  }
}

function mapComplaintRow(row: Record<string, unknown>): Complaint {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    subject: String(row.subject),
    detail: (row.detail as string | null) ?? null,
    status: row.status as ComplaintStatus,
    siteId: (row.site_id as string | null) ?? null,
    repairCaseId: (row.repair_case_id as string | null) ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapRelatedRepairCaseRow(
  row: Record<string, unknown>,
): RelatedRepairCase {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    fromRepairCaseId: String(row.from_repair_case_id),
    toRepairCaseId: String(row.to_repair_case_id),
    note: (row.note as string | null) ?? null,
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapMaterialUsageRow(row: Record<string, unknown>): MaterialUsage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    materialId: String(row.material_id),
    materialName: String(row.material_name),
    qty: Number(row.qty),
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    repairCaseId: (row.repair_case_id as string | null) ?? null,
    siteId: (row.site_id as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    clientOperationId: String(row.client_operation_id),
    postedAt: String(row.posted_at),
    createdBy: String(row.created_by ?? ''),
  }
}

function mapStockLocationRow(row: Record<string, unknown>): StockLocation {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    kind: row.kind as StockLocation['kind'],
    name: String(row.name),
    siteId: (row.site_id as string | null) ?? null,
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
  }
}

function mapStockBalanceRow(row: Record<string, unknown>): StockBalance {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    materialId: String(row.material_id),
    locationId: String(row.location_id),
    qty: Number(row.qty),
    updatedAt: String(row.updated_at),
  }
}

function mapStockMovementRow(row: Record<string, unknown>): StockMovement {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    movementType: row.movement_type as StockMovement['movementType'],
    materialId: String(row.material_id),
    materialName: String(row.material_name),
    qty: Number(row.qty),
    unitCost: Number(row.unit_cost),
    fromLocationId: (row.from_location_id as string | null) ?? null,
    toLocationId: (row.to_location_id as string | null) ?? null,
    reservationId: (row.reservation_id as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    clientOperationId: String(row.client_operation_id),
    postedAt: String(row.posted_at),
    createdBy: String(row.created_by ?? ''),
    reversalOf: (row.reversal_of as string | null) ?? null,
  }
}

function mapStockReservationRow(row: Record<string, unknown>): StockReservation {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    materialId: String(row.material_id),
    locationId: (row.location_id as string | null) ?? null,
    qty: Number(row.qty),
    status: row.status as StockReservation['status'],
    note: (row.note as string | null) ?? null,
    clientOperationId: String(row.client_operation_id),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? ''),
    releasedAt: (row.released_at as string | null) ?? null,
  }
}

const PROFILE_SELECT_CORE =
  'id, organization_id, name, role, email, login_id, phone, pay_type, line_user_id, finance_authorized, nickname, birth_date, job_title, hired_at, account_status, profile_notes, must_change_password, created_at'

/** Includes role-group columns when migration is applied; falls back to core. */
const PROFILE_SELECT = `${PROFILE_SELECT_CORE}, role_group_name, role_group_id, access_template, features, permission_overrides`

async function selectProfileRow(userId: string) {
  const client = sb()
  const full = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()
  if (
    full.error &&
    /role_group_name|access_template|login_id|must_change_password|column/i.test(
      full.error.message,
    )
  ) {
    const core = await client
      .from('profiles')
      .select(PROFILE_SELECT_CORE)
      .eq('id', userId)
      .maybeSingle()
    if (
      core.error &&
      /login_id|must_change_password|column/i.test(core.error.message)
    ) {
      const withoutMust = await client
        .from('profiles')
        .select(
          'id, organization_id, name, role, email, login_id, phone, pay_type, line_user_id, finance_authorized, nickname, birth_date, job_title, hired_at, account_status, profile_notes, created_at',
        )
        .eq('id', userId)
        .maybeSingle()
      if (
        withoutMust.error &&
        /login_id|column/i.test(withoutMust.error.message)
      ) {
        return client
          .from('profiles')
          .select(
            'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, nickname, birth_date, job_title, hired_at, account_status, profile_notes, created_at',
          )
          .eq('id', userId)
          .maybeSingle()
      }
      return withoutMust
    }
    return core
  }
  return full
}

function mapUser(row: {
  id: string
  organization_id: string
  name: string
  role: string
  email: string | null
  login_id?: string | null
  must_change_password?: boolean | null
  phone: string | null
  pay_type: AppUser['payType'] | null
  line_user_id: string | null
  finance_authorized: boolean | null
  nickname?: string | null
  birth_date?: string | null
  job_title?: string | null
  hired_at?: string | null
  account_status?: string | null
  profile_notes?: string | null
  role_group_name?: string | null
  role_group_id?: string | null
  access_template?: string | null
  features?: Record<string, boolean> | null
  permission_overrides?: Record<string, boolean> | null
  created_at: string
}): AppUser {
  const accessTemplate =
    row.access_template === 'owner' ||
    row.access_template === 'admin' ||
    row.access_template === 'member'
      ? row.access_template
      : null
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    role: row.role as UserRole,
    email: row.email ?? undefined,
    loginId: row.login_id ?? null,
    mustChangePassword: Boolean(row.must_change_password),
    phone: row.phone ?? undefined,
    payType: row.pay_type ?? undefined,
    lineUserId: row.line_user_id,
    financeAuthorized: Boolean(row.finance_authorized),
    nickname: row.nickname ?? null,
    birthDate: row.birth_date ?? null,
    jobTitle: row.job_title ?? null,
    hiredAt: row.hired_at ?? null,
    accountStatus:
      row.account_status === 'disabled' ? 'disabled' : 'active',
    notes: row.profile_notes ?? null,
    roleGroupName: row.role_group_name ?? null,
    roleGroupId: row.role_group_id ?? null,
    accessTemplate,
    features: row.features ?? null,
    permissionOverrides: row.permission_overrides ?? null,
    createdAt: row.created_at,
  }
}

function mapSite(row: Record<string, unknown>): SiteProject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    kind: row.kind as SiteProject['kind'],
    status: row.status as SiteProject['status'],
    address: (row.address as string | null) ?? undefined,
    customerName: (row.customer_name as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    warrantyUntil: (row.warranty_until as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    version: Number(row.version ?? 1),
  }
}

function mapAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    status: row.status as AttendanceRecord['status'],
    clockInAt: String(row.clock_in_at),
    clockOutAt: (row.clock_out_at as string | null) ?? null,
    siteId: (row.site_id as string | null) ?? null,
    jobType: (row.job_type as AttendanceRecord['jobType']) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    note: (row.note as string | null) ?? null,
  }
}

function mapLocationCheckin(
  row: Record<string, unknown>,
  siteNames: Map<string, string>,
): LocationCheckin {
  const siteId = (row.site_id as string | null) ?? null
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    recordedAt: String(row.recorded_at),
    source: row.source as LocationCheckin['source'],
    siteId,
    siteName: siteId ? siteNames.get(siteId) ?? null : null,
    label: (row.label as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    note: (row.note as string | null) ?? null,
    attendanceId: (row.attendance_id as string | null) ?? null,
  }
}

function mapEmployeeAdvance(row: Record<string, unknown>): EmployeeAdvance {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name),
    siteId: row.site_id ? String(row.site_id) : null,
    siteName: String(row.site_name),
    locationText: (row.location_text as string | null) ?? null,
    item: String(row.item),
    amount: Number(row.amount),
    note: (row.note as string | null) ?? null,
    receiptPhotoPath: (row.receipt_photo_path as string | null) ?? null,
    status: row.status as EmployeeAdvance['status'],
    reportedAt: String(row.reported_at),
    settledAt: (row.settled_at as string | null) ?? null,
    settledBy: (row.settled_by as string | null) ?? null,
    expenseReportId: (row.expense_report_id as string | null) ?? null,
  }
}

function mapPaySetting(row: Record<string, unknown>): EmployeePaySetting {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    payType: row.pay_type as PayType,
    baseAmount: Number(row.base_amount),
    effectiveFrom: String(row.effective_from).slice(0, 10),
    note: (row.note as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapSalaryEntry(row: Record<string, unknown>): SalaryEntry {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    periodYear: Number(row.period_year),
    periodMonth: Number(row.period_month),
    entryDate: String(row.entry_date).slice(0, 10),
    category: row.category as SalaryEntry['category'],
    amount: Number(row.amount),
    title: String(row.title),
    note: (row.note as string | null) ?? null,
    siteId: row.site_id ? String(row.site_id) : null,
    siteName: (row.site_name as string | null) ?? null,
    status: row.status as SalaryEntry['status'],
    createdBy: String(row.created_by),
    confirmedBy: (row.confirmed_by as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    paidBy: (row.paid_by as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    cancelledBy: (row.cancelled_by as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    cancelReason: (row.cancel_reason as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

const ATTENDANCE_CORRECTION_COLS =
  'id, organization_id, user_id, attendance_id, proposed_clock_in_at, proposed_clock_out_at, proposed_site_id, reason, status, original_clock_in_at, original_clock_out_at, original_site_id, effective_clock_in_at, effective_clock_out_at, effective_site_id, reviewed_by, reviewed_at, review_note, created_at'

function mapAttendanceCorrection(row: Record<string, unknown>): AttendanceCorrection {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    attendanceId: (row.attendance_id as string | null) ?? null,
    proposedClockInAt: String(row.proposed_clock_in_at),
    proposedClockOutAt: (row.proposed_clock_out_at as string | null) ?? null,
    proposedSiteId: (row.proposed_site_id as string | null) ?? null,
    reason: String(row.reason),
    status: row.status as AttendanceCorrection['status'],
    originalClockInAt: (row.original_clock_in_at as string | null) ?? null,
    originalClockOutAt: (row.original_clock_out_at as string | null) ?? null,
    originalSiteId: (row.original_site_id as string | null) ?? null,
    effectiveClockInAt: (row.effective_clock_in_at as string | null) ?? null,
    effectiveClockOutAt: (row.effective_clock_out_at as string | null) ?? null,
    effectiveSiteId: (row.effective_site_id as string | null) ?? null,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewNote: (row.review_note as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

function mapPurchase(row: Record<string, unknown>): PurchaseRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    siteId: (row.site_id as string | null) ?? null,
    supplierId: (row.supplier_id as string | null) ?? null,
    mode: row.mode as PurchaseMode,
    status: row.status as PurchaseRecord['status'],
    title: String(row.title),
    goodsAmount: Number(row.goods_amount),
    discount: Number(row.discount),
    tax: Number(row.tax),
    shipping: Number(row.shipping),
    otherBuyerFees: Number(row.other_buyer_fees),
    finalPayable: Number(row.final_payable),
    createdAt: String(row.created_at),
    businessDate: String(row.business_date),
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    rejectedReason: (row.rejected_reason as string | null) ?? null,
    inboundMaterialId: (row.inbound_material_id as string | null) ?? null,
    inboundQty: row.inbound_qty == null ? null : Number(row.inbound_qty),
    inboundAt: (row.inbound_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
  }
}

export const supabaseRepos = {
  async getCurrentUser(): Promise<AppUser | null> {
    const client = sb()
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError || !auth.user) {
      // Missing / expired session is a logged-out state, not a hard failure.
      return null
    }

    const { data, error } = await selectProfileRow(auth.user.id)
    if (error) throw new AppError(toUserMessage(error, '無法讀取個人資料'))
    if (!data) return null
    return mapUser({ ...data, email: data.email ?? auth.user.email ?? null })
  },

  async signIn(account: string, password: string): Promise<AppUser> {
    const client = sb()
    let authEmail: string
    try {
      authEmail = accountToAuthEmail(account).authEmail
    } catch (e) {
      throw new AppError(e instanceof Error ? e.message : '帳號格式無效')
    }
    const { data, error } = await client.auth.signInWithPassword({
      email: authEmail,
      password,
    })
    if (error) throw new AppError(toUserMessage(error, '登入失敗'))
    if (!data.user) throw new AppError('登入失敗')

    const { data: profile, error: profileError } = await selectProfileRow(
      data.user.id,
    )
    if (profileError) throw new AppError(toUserMessage(profileError, '無法讀取個人資料'))
    if (!profile) throw new AppError('帳號已登入，但尚未建立 profiles 資料列')
    return mapUser({ ...profile, email: profile.email ?? data.user.email ?? null })
  },

  /**
   * Self-serve signup: Auth user + complete_signup RPC for org/profile.
   * Account may be a custom login id or a real email.
   * - organizationName empty → join oldest existing org (or create default)
   * - organizationName set → create new company; first user becomes Owner
   */
  async signUp(input: {
    name: string
    /** Custom login id or real email. */
    account: string
    password: string
    organizationName?: string | null
  }): Promise<AppUser> {
    const client = sb()
    const name = input.name.trim()
    if (!name) throw new AppError('請填寫姓名')
    if (input.password.length < 6) throw new AppError('密碼至少 6 碼')

    let authEmail: string
    let loginId: string | null
    try {
      const resolved = accountToAuthEmail(input.account)
      authEmail = resolved.authEmail
      loginId = resolved.loginId
    } catch (e) {
      throw new AppError(e instanceof Error ? e.message : '帳號格式無效')
    }

    const { data, error } = await client.auth.signUp({
      email: authEmail,
      password: input.password,
      options: {
        data: { name, login_id: loginId },
      },
    })
    if (error) throw new AppError(toUserMessage(error, '建立帳號失敗'))
    if (!data.user) throw new AppError('建立帳號失敗')

    // Email confirmation enabled → no session yet (custom ids need Confirm email OFF)
    if (!data.session) {
      throw new AppError(
        loginId
          ? '帳號已建立，但尚需信箱驗證。請在 Supabase Auth 關閉「Confirm email」後再以自訂帳號註冊，或改用真實 Email。'
          : '帳號已建立，請至信箱完成驗證後再登入（若未收到信，請在 Supabase Auth 關閉「Confirm email」）',
      )
    }

    const { data: profile, error: profileError } = await client.rpc('complete_signup', {
      p_name: name,
      p_org_name: input.organizationName?.trim() || null,
      p_login_id: loginId,
    })
    if (profileError) {
      throw new AppError(toUserMessage(profileError, '帳號已建立，但無法建立個人資料'))
    }

    // rpc may return object or array depending on PostgREST
    const row = Array.isArray(profile) ? profile[0] : profile
    if (!row) throw new AppError('帳號已建立，但無法讀取個人資料')
    return mapUser({
      ...row,
      email: row.email ?? data.user.email ?? authEmail,
      login_id: row.login_id ?? loginId,
    })
  },

  async signOut(): Promise<void> {
    const { error } = await sb().auth.signOut()
    // Already signed out / missing session is fine.
    if (error && !/session|not authenticated|jwt/i.test(error.message)) {
      throw new AppError(toUserMessage(error, '登出失敗'))
    }
  },

  /**
   * Boss / account-permission holders create a teammate.
   * Default login id + password = phone digits; must_change_password = true.
   */
  async createMemberAccount(
    actor: AppUser,
    input: { name: string; phone: string; roleGroupName?: string | null },
  ): Promise<{ user: AppUser; message: string }> {
    assertFeature(actor, 'account')
    const { data, error } = await sb().functions.invoke('admin-create-member', {
      body: {
        name: input.name,
        phone: input.phone,
        roleGroupName: input.roleGroupName ?? null,
      },
    })
    const body = data as {
      error?: string
      message?: string
      user?: Parameters<typeof mapUser>[0]
    } | null
    if (error) {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        try {
          const errBody = (await ctx.json()) as { error?: string }
          if (errBody?.error) throw new AppError(errBody.error)
        } catch (e) {
          if (e instanceof AppError) throw e
        }
      }
      if (body?.error) throw new AppError(body.error)
      throw new AppError(toUserMessage(error, '無法建立帳號'))
    }
    if (!body || body.error) {
      throw new AppError(body?.error || '無法建立帳號')
    }
    if (!body.user) throw new AppError('建立帳號成功但無法讀取資料')
    return {
      user: mapUser(body.user),
      message: body.message || '已建立帳號',
    }
  },

  async changeOwnPassword(newPassword: string): Promise<AppUser> {
    if (newPassword.length < 6) throw new AppError('新密碼至少 6 碼')
    const client = sb()
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) throw new AppError(toUserMessage(error, '更改密碼失敗'))

    const { data, error: rpcError } = await client.rpc('mark_password_changed')
    if (rpcError) {
      throw new AppError(toUserMessage(rpcError, '密碼已更新，但無法清除改密標記'))
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      const current = await this.getCurrentUser()
      if (!current) throw new AppError('密碼已更新，請重新登入')
      return { ...current, mustChangePassword: false }
    }
    return mapUser({
      ...row,
      must_change_password: false,
    })
  },

  async listAllowedSiteIds(userId: string): Promise<string[]> {
    const { data, error } = await sb()
      .from('site_members')
      .select('site_id')
      .eq('user_id', requireUuid(userId, '使用者'))
    if (error) throw new AppError(toUserMessage(error, '無法讀取工地權限'))
    return (data ?? []).map((r) => String(r.site_id))
  },

  async orgHasSiteAssignments(organizationId: string): Promise<boolean> {
    const { count, error } = await sb()
      .from('site_members')
      .select('site_id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
    if (error) {
      // Table missing / not applied yet → treat as not configured
      console.warn('[site_members] count failed', error.message)
      return false
    }
    return (count ?? 0) > 0
  },

  async listSiteMemberIds(siteId: string): Promise<string[]> {
    const { data, error } = await sb()
      .from('site_members')
      .select('user_id')
      .eq('site_id', requireUuid(siteId, '工地'))
    if (error) throw new AppError(toUserMessage(error, '無法讀取工地成員'))
    return (data ?? []).map((r) => String(r.user_id))
  },

  async setSiteMembers(
    actor: AppUser,
    siteId: string,
    userIds: string[],
  ): Promise<void> {
    if (actor.role !== 'boss') throw new AppError('僅老闆可設定工地權限')
    const sid = requireUuid(siteId, '工地')
    const { error: delError } = await sb()
      .from('site_members')
      .delete()
      .eq('site_id', sid)
    if (delError) throw new AppError(toUserMessage(delError, '無法更新工地權限'))
    const rows = userIds.map((uid) => ({
      site_id: sid,
      user_id: requireUuid(uid, '成員'),
      organization_id: actor.organizationId,
      created_by: actor.id,
    }))
    if (rows.length === 0) return
    const { error } = await sb().from('site_members').insert(rows)
    if (error) throw new AppError(toUserMessage(error, '無法更新工地權限'))
    await this.appendAuditLog(actor, {
      action: 'permission.update',
      targetType: 'site_members',
      targetId: sid,
      after: { userIds },
    })
  },

  async updateProfile(
    actor: AppUser,
    targetUserId: string,
    input: {
      name?: string | null
      nickname?: string | null
      birthDate?: string | null
      jobTitle?: string | null
      hiredAt?: string | null
      notes?: string | null
      accountStatus?: string | null
    },
  ): Promise<AppUser> {
    const tid = requireUuid(targetUserId, '使用者')
    const self = actor.id === tid
    if (!self && actor.role !== 'boss') {
      throw new AppError('僅本人或老闆可更新資料')
    }
    const fields = normalizeProfileFields(input)
    const payload: Record<string, unknown> = {
      nickname: fields.nickname,
      birth_date: fields.birthDate,
      job_title: fields.jobTitle,
      profile_notes: fields.notes,
    }
    if (input.name != null) {
      payload.name = normalizeProfileName(input.name)
    }
    // 到職日：員工僅能首次填寫；之後僅老闆可改
    if (input.hiredAt !== undefined) {
      let existingHired: string | null = null
      if (tid === actor.id) {
        existingHired = actor.hiredAt ?? null
      } else {
        const { data: hiredRow } = await sb()
          .from('profiles')
          .select('hired_at')
          .eq('id', tid)
          .maybeSingle()
        existingHired = (hiredRow?.hired_at as string | null) ?? null
      }
      const nextHired = fields.hiredAt
      if (existingHired && actor.role !== 'boss') {
        if (nextHired !== existingHired) {
          throw new AppError('到職日已鎖定，僅老闆可修改')
        }
      } else {
        payload.hired_at = nextHired
      }
    }
    if (input.accountStatus != null) {
      if (actor.role !== 'boss') throw new AppError('僅老闆可停用帳號')
      payload.account_status = assertAccountStatus(input.accountStatus)
    }
    const updated = await sb()
      .from('profiles')
      .update(payload)
      .eq('id', tid)
      .select(PROFILE_SELECT)
      .single()
    let row = updated.data
    let updError = updated.error
    if (updError && /role_group_name|access_template|column/i.test(updError.message)) {
      const fallback = await sb()
        .from('profiles')
        .update(payload)
        .eq('id', tid)
        .select(PROFILE_SELECT_CORE)
        .single()
      row = fallback.data as typeof row
      updError = fallback.error
    }
    if (updError || !row) {
      throw new AppError(toUserMessage(updError, '無法更新個人資料'))
    }
    const mapped = mapUser(row)
    await this.appendAuditLog(actor, {
      action: 'permission.update',
      targetType: 'profile',
      targetId: tid,
      after: mapped,
    })
    return mapped
  },

  async listOrgProfiles(actor: AppUser): Promise<AppUser[]> {
    if (actor.role !== 'boss') throw new AppError('僅老闆可查看完整名冊')
    const full = await sb()
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('organization_id', actor.organizationId)
      .order('name')
    if (
      full.error &&
      /role_group_name|access_template|column/i.test(full.error.message)
    ) {
      const fallback = await sb()
        .from('profiles')
        .select(PROFILE_SELECT_CORE)
        .eq('organization_id', actor.organizationId)
        .order('name')
      if (fallback.error) {
        throw new AppError(toUserMessage(fallback.error, '無法載入名冊'))
      }
      return (fallback.data ?? []).map((row) => mapUser(row))
    }
    if (full.error) throw new AppError(toUserMessage(full.error, '無法載入名冊'))
    return (full.data ?? []).map((row) => mapUser(row))
  },

  async listSites(actor?: AppUser): Promise<SiteProject[]> {
    if (actor) {
      assertPermission(actor.role, PERMISSIONS.SITE_READ, {
        financeAuthorized: actor.financeAuthorized,
      })
    }
    const { data, error } = await sb()
      .from('sites')
      .select(
        'id, organization_id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at, version',
      )
      .order('updated_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入工地列表'))
    const sites = (data ?? []).map((row) => mapSite(row))
    if (!actor || actor.role === 'boss') return sites
    const [allowed, orgHasAssignments] = await Promise.all([
      this.listAllowedSiteIds(actor.id),
      this.orgHasSiteAssignments(actor.organizationId),
    ])
    return filterSitesByAccess({
      role: actor.role,
      sites,
      allowedSiteIds: allowed,
      orgHasAssignments,
    })
  },

  async getSite(id: string, actor?: AppUser): Promise<SiteProject | null> {
    // Invalid route ids must not hit Postgres or crash the page.
    if (!isUuid(id)) return null
    if (actor) {
      assertPermission(actor.role, PERMISSIONS.SITE_READ, {
        financeAuthorized: actor.financeAuthorized,
      })
    }
    const { data, error } = await sb()
      .from('sites')
      .select(
        'id, organization_id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at, version',
      )
      .eq('id', id)
      .maybeSingle()
    if (error) throw new AppError(toUserMessage(error, '無法載入工地'))
    if (!data) return null
    const site = mapSite(data)
    if (actor) assertSameOrganization(actor.organizationId, site.organizationId)
    if (actor && actor.role !== 'boss') {
      const [allowed, orgHasAssignments] = await Promise.all([
        this.listAllowedSiteIds(actor.id),
        this.orgHasSiteAssignments(actor.organizationId),
      ])
      assertCanAccessSite({
        role: actor.role,
        siteId: site.id,
        allowedSiteIds: allowed,
        orgHasAssignments,
      })
    }
    return site
  },

  async createSite(
    actor: AppUser,
    input: {
      name: string
      kind: SiteProject['kind']
      address?: string
      customerName?: string
      warrantyUntil?: string | null
    },
  ): Promise<SiteProject> {
    assertPermission(actor.role, PERMISSIONS.SITE_WRITE, {
      financeAuthorized: actor.financeAuthorized,
    })
    // organization_id set by DB trigger from current_user_org_id()
    const { data, error } = await sb()
      .from('sites')
      .insert({
        name: input.name.trim(),
        kind: input.kind,
        address: input.address?.trim() || null,
        customer_name: input.customerName?.trim() || null,
        warranty_until: input.warrantyUntil || null,
        status: 'active',
      })
      .select(
        'id, organization_id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at, version',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立工地'))
    const site = mapSite(data)
    assertSameOrganization(actor.organizationId, site.organizationId)
    return site
  },

  async updateSiteWarranty(
    actor: AppUser,
    siteId: string,
    warrantyUntil: string | null,
  ): Promise<SiteProject> {
    assertPermission(actor.role, PERMISSIONS.SITE_WRITE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const sid = requireUuid(siteId, '工地')
    const { data, error } = await sb()
      .from('sites')
      .update({
        warranty_until: warrantyUntil || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sid)
      .select(
        'id, organization_id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at, version',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新保固日期'))
    const site = mapSite(data)
    assertSameOrganization(actor.organizationId, site.organizationId)
    return site
  },

  async getSiteDeleteImpact(actor: AppUser, siteId: string) {
    const sid = requireUuid(siteId, '工地')
    const current = await this.getSite(sid, actor)
    if (!current) throw new AppError('找不到工地')
    const photos = await this.listPhotoUploads(sid)
    const expenses = (await this.listExpenseReports(actor)).filter(
      (e) => e.siteId === sid,
    )
    const receipts = (await this.listCashReceipts(actor)).filter(
      (r) => r.siteId === sid,
    )
    const quotes = (await this.listQuotations()).filter(
      (q) => q.projectId === sid && !q.deletedAt,
    )
    const { data: attRows } = await sb()
      .from('attendance')
      .select('id')
      .eq('site_id', sid)
    const { data: defectRows } = await sb()
      .from('defects')
      .select('id')
      .eq('site_id', sid)
    return buildSiteDeleteImpact({
      siteId: sid,
      siteName: current.name,
      photoCount: photos.length,
      pendingExpenseCount: expenses.filter((e) => e.status === 'pending_review')
        .length,
      confirmedExpenseCount: expenses.filter((e) => e.status === 'confirmed')
        .length,
      pendingReceiptCount: receipts.filter((r) => r.status === 'pending_confirm')
        .length,
      confirmedReceiptCount: receipts.filter((r) => r.status === 'confirmed')
        .length,
      attendanceCount: (attRows ?? []).length,
      quoteCount: quotes.length,
      defectCount: (defectRows ?? []).length,
    })
  },

  async deleteSite(actor: AppUser, siteId: string): Promise<void> {
    assertFeature(actor, 'site_delete')
    const sid = requireUuid(siteId, '工地')
    const impact = await this.getSiteDeleteImpact(actor, sid)
    if (impact.blocked) {
      throw new AppError(impact.blockReason || '不可刪除案件')
    }
    const current = await this.getSite(sid, actor)
    if (!current) throw new AppError('找不到工地')

    // Photos first — if this fails, site remains intact for retry.
    const photos = await this.listPhotoUploads(sid)
    if (photos.length > 0) {
      await this.deletePhotoUploads(photos.map((p) => p.id))
    }

    const label = deletedSiteFinanceLabel(current.name)
    await sb()
      .from('expense_reports')
      .update({ site_id: null, site_name: label })
      .eq('site_id', sid)
    await sb()
      .from('cash_receipt_reports')
      .update({ site_id: null, site_name: label })
      .eq('site_id', sid)

    const quotes = (await this.listQuotations()).filter(
      (q) => q.projectId === sid && !q.deletedAt,
    )
    for (const q of quotes) {
      await this.softDeleteQuotation(actor, q.id, '刪除工地案件')
    }
    if (quotes.length > 0) {
      const { error: unlinkError } = await sb()
        .from('quotations')
        .update({ project_id: null })
        .eq('project_id', sid)
        .not('deleted_at', 'is', null)
      if (unlinkError) {
        throw new AppError(
          toUserMessage(unlinkError, '無法解除報價與工地關聯，請先處理報價後再刪'),
        )
      }
    }

    await sb().from('site_members').delete().eq('site_id', sid)

    const { error } = await sb().from('sites').delete().eq('id', sid)
    if (error) {
      throw new AppError(
        toUserMessage(
          error,
          '照片可能已刪除，但案件刪除失敗。請重試或改用結案封存。',
        ),
      )
    }
    await this.appendAuditLog(actor, {
      action: 'site.delete',
      targetType: 'site',
      targetId: sid,
      before: current,
    })
  },

  async listRoleGroups(actor: AppUser) {
    const { data, error } = await sb()
      .from('org_role_groups')
      .select('id, name, template, finance_authorized, permissions')
      .eq('organization_id', actor.organizationId)
      .order('name')
    if (error) {
      return []
    }
    return (data ?? []).map((row) =>
      withNormalizedFeatures({
        id: String(row.id),
        name: String(row.name),
        template: row.template as 'owner' | 'admin' | 'member' | 'finance',
        financeAuthorized: Boolean(row.finance_authorized),
        features: (row.permissions as Record<string, boolean> | null) ?? null,
      }),
    )
  },

  async createRoleGroup(
    actor: AppUser,
    input: {
      name: string
      template: 'owner' | 'admin' | 'member' | 'finance'
      financeAuthorized: boolean
      features?: import('@/domain/featureAccess').FeatureMap
    },
  ) {
    assertFeature(actor, 'account')
    const name = input.name.trim()
    if (!name) throw new AppError('請輸入身分組名稱')
    const features =
      input.features ?? templateToAccessFields(input.template).features
    const { data, error } = await sb()
      .from('org_role_groups')
      .insert({
        organization_id: actor.organizationId,
        name,
        template: input.template,
        finance_authorized: Boolean(input.financeAuthorized),
        permissions: features,
        created_by: actor.id,
      })
      .select('id, name, template, finance_authorized, permissions')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立身分組'))
    return withNormalizedFeatures({
      id: String(data.id),
      name: String(data.name),
      template: data.template as 'owner' | 'admin' | 'member' | 'finance',
      financeAuthorized: Boolean(data.finance_authorized),
      features: (data.permissions as Record<string, boolean> | null) ?? features,
    })
  },

  async updateRoleGroupFeatures(
    actor: AppUser,
    groupId: string,
    features: import('@/domain/featureAccess').FeatureMap,
  ) {
    assertFeature(actor, 'account')
    const { data, error } = await sb()
      .from('org_role_groups')
      .update({ permissions: features })
      .eq('id', requireUuid(groupId, '身分組'))
      .eq('organization_id', actor.organizationId)
      .select('id, name, template, finance_authorized, permissions')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新身分組權限'))
    return withNormalizedFeatures({
      id: String(data.id),
      name: String(data.name),
      template: data.template as 'owner' | 'admin' | 'member' | 'finance',
      financeAuthorized: Boolean(data.finance_authorized),
      features: (data.permissions as Record<string, boolean> | null) ?? features,
    })
  },

  async setMemberAccess(
    actor: AppUser,
    targetUserId: string,
    input: {
      roleGroupId?: string | null
      roleGroupName: string
      accessTemplate: 'owner' | 'admin' | 'member'
      financeAuthorized: boolean
      features?: import('@/domain/featureAccess').FeatureMap | null
      permissionOverrides?: Partial<
        import('@/domain/featureAccess').FeatureMap
      > | null
    },
  ): Promise<AppUser> {
    assertFeature(actor, 'account')
    const tid = requireUuid(targetUserId, '使用者')
    const { data, error } = await sb().rpc('boss_set_member_access', {
      p_target_user_id: tid,
      p_role_group_name: input.roleGroupName,
      p_access_template: input.accessTemplate,
      p_finance_authorized: input.financeAuthorized,
      p_role_group_id: input.roleGroupId ?? null,
      p_features: input.features ?? null,
      p_permission_overrides: input.permissionOverrides ?? null,
    })
    if (error) {
      const msg = error.message || ''
      if (/boss_set_member_access|schema cache|Could not find the function/i.test(msg)) {
        throw new AppError(
          '後端尚未安裝權限設定函式。請在 Supabase 執行 migration：20261111_boss_set_member_access_apply.sql 後再試。',
        )
      }
      if (/privileged profile fields/i.test(msg)) {
        throw new AppError(
          '權限欄位受保護，無法直接修改。請確認已套用最新資料庫更新後再試。',
        )
      }
      throw new AppError(toUserMessage(error, '無法設定權限'))
    }
    if (!data) throw new AppError('無法設定權限')
    const mapped = mapUser(data as Parameters<typeof mapUser>[0])
    await this.appendAuditLog(actor, {
      action: 'permission.update',
      targetType: 'profile',
      targetId: tid,
      after: mapped,
    })
    return mapped
  },

  async updateSiteStatus(
    actor: AppUser,
    siteId: string,
    status: SiteProject['status'],
  ): Promise<SiteProject> {
    if (actor.role !== 'boss') {
      throw new AppError('僅老闆可結案／重開工地')
    }
    assertPermission(actor.role, PERMISSIONS.SITE_WRITE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const sid = requireUuid(siteId, '工地')
    const current = await this.getSite(sid, actor)
    if (!current) throw new AppError('找不到工地')
    const next = assertSiteStatus(status)
    assertSiteStatusTransition({ from: current.status, to: next })
    const { data, error } = await sb()
      .from('sites')
      .update({
        status: next,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sid)
      .select(
        'id, organization_id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at, version',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新工地狀態'))
    const site = mapSite(data)
    assertSameOrganization(actor.organizationId, site.organizationId)
    return site
  },

  /** Create in-app notices for sites with warranty ending within daysAhead. */
  async ensureWarrantyNotices(actor: AppUser, daysAhead = 30): Promise<number> {
    const today = taipeiDateString()
    const until = new Date()
    until.setDate(until.getDate() + daysAhead)
    const untilStr = taipeiDateString(until)

    const { data: sites, error } = await sb()
      .from('sites')
      .select('id, name, warranty_until')
      .not('warranty_until', 'is', null)
      .gte('warranty_until', today)
      .lte('warranty_until', untilStr)
    if (error) throw new AppError(toUserMessage(error, '無法檢查保固'))

    let created = 0
    for (const site of sites ?? []) {
      const title = `保固即將到期：${site.name}`
      const { data: existing } = await sb()
        .from('notices')
        .select('id')
        .eq('user_id', actor.id)
        .eq('title', title)
        .eq('status', 'open')
        .limit(1)
      if (existing && existing.length > 0) continue

      const { error: noticeError } = await sb().rpc('create_org_notices', {
        p_recipient_ids: [actor.id],
        p_kind: 'todo',
        p_title: title,
        p_detail: `保固日 ${site.warranty_until}（${daysAhead} 天內）。請確認是否需安排回訪。`,
        p_href: `/sites/${site.id}`,
        p_as_todo: true,
      })
      if (!noticeError) created += 1
    }
    return created
  },

  async getOpenAttendance(userId: string): Promise<AttendanceRecord | null> {
    requireUuid(userId, '使用者')
    const { data, error } = await sb()
      .from('attendance')
      .select(
        'id, organization_id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
      )
      .eq('user_id', userId)
      .eq('status', 'clocked_in')
      .maybeSingle()
    if (error) throw new AppError(toUserMessage(error, '無法讀取出勤狀態'))
    return data ? mapAttendance(data) : null
  },

  async listAttendance(userId: string): Promise<AttendanceRecord[]> {
    requireUuid(userId, '使用者')
    const { data, error } = await sb()
      .from('attendance')
      .select(
        'id, organization_id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
      )
      .eq('user_id', userId)
      .order('clock_in_at', { ascending: false })
      .limit(50)
    if (error) throw new AppError(toUserMessage(error, '無法讀取出勤紀錄'))
    return (data ?? []).map((row) => mapAttendance(row))
  },

  async listAttendanceForMonth(
    actor: AppUser,
    input: { userId: string; year: number; month: number },
  ): Promise<AttendanceRecord[]> {
    const uid = requireUuid(input.userId, '使用者')
    if (actor.role !== 'boss' && actor.id !== uid) {
      throw new AppError('只能查看自己的出勤')
    }
    const mm = String(input.month).padStart(2, '0')
    const start = `${input.year}-${mm}-01T00:00:00+08:00`
    const endMonth = input.month === 12 ? 1 : input.month + 1
    const endYear = input.month === 12 ? input.year + 1 : input.year
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00+08:00`
    const { data, error } = await sb()
      .from('attendance')
      .select(
        'id, organization_id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
      )
      .eq('user_id', uid)
      .gte('clock_in_at', start)
      .lt('clock_in_at', end)
      .order('clock_in_at', { ascending: true })
      .limit(200)
    if (error) throw new AppError(toUserMessage(error, '無法讀取出勤紀錄'))
    return (data ?? []).map((row) => mapAttendance(row))
  },

  async getEmployeePaySetting(
    actor: AppUser,
    userId: string,
  ): Promise<EmployeePaySetting | null> {
    const uid = requireUuid(userId, '使用者')
    if (actor.role !== 'boss' && actor.id !== uid) {
      throw new AppError('只能查看自己的薪資設定')
    }
    const { data, error } = await sb()
      .from('employee_pay_settings')
      .select(
        'id, organization_id, user_id, pay_type, base_amount, effective_from, note, updated_by, created_at, updated_at',
      )
      .eq('user_id', uid)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new AppError(toUserMessage(error, '無法讀取薪資設定'))
    return data ? mapPaySetting(data) : null
  },

  async upsertEmployeePaySetting(
    actor: AppUser,
    input: {
      userId: string
      payType: PayType
      baseAmount: number
      effectiveFrom: string
      note?: string | null
    },
  ): Promise<EmployeePaySetting> {
    assertBossSalaryAction(actor.role)
    const uid = requireUuid(input.userId, '使用者')
    const payType = assertPayType(input.payType)
    const baseAmount = Math.round(Number(input.baseAmount))
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      throw new AppError('基本薪資需為 0 以上整數')
    }
    const effectiveFrom = input.effectiveFrom.slice(0, 10)
    const now = new Date().toISOString()
    const { data: existing } = await sb()
      .from('employee_pay_settings')
      .select('id')
      .eq('user_id', uid)
      .eq('effective_from', effectiveFrom)
      .maybeSingle()

    const payload = {
      user_id: uid,
      pay_type: payType,
      base_amount: baseAmount,
      effective_from: effectiveFrom,
      note: input.note?.trim() || null,
      updated_by: actor.id,
      updated_at: now,
    }

    const query = existing?.id
      ? sb()
          .from('employee_pay_settings')
          .update(payload)
          .eq('id', existing.id)
          .select(
            'id, organization_id, user_id, pay_type, base_amount, effective_from, note, updated_by, created_at, updated_at',
          )
          .single()
      : sb()
          .from('employee_pay_settings')
          .insert(payload)
          .select(
            'id, organization_id, user_id, pay_type, base_amount, effective_from, note, updated_by, created_at, updated_at',
          )
          .single()

    const { data, error } = await query
    if (error) throw new AppError(toUserMessage(error, '無法儲存薪資設定'))
    const row = mapPaySetting(data)
    await this.appendAuditLog(actor, {
      action: 'salary.setting',
      targetType: 'employee_pay_settings',
      targetId: row.id,
      after: row,
    })
    // keep profiles.pay_type in sync for display
    await sb().from('profiles').update({ pay_type: payType }).eq('id', uid)
    return row
  },

  async listSalaryEntries(
    actor: AppUser,
    input: { year: number; month: number; userId?: string },
  ): Promise<SalaryEntry[]> {
    let q = sb()
      .from('salary_entries')
      .select(
        'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at',
      )
      .eq('period_year', input.year)
      .eq('period_month', input.month)
      .order('entry_date', { ascending: true })
      .limit(500)
    if (input.userId) {
      const uid = requireUuid(input.userId, '使用者')
      if (actor.role !== 'boss' && actor.id !== uid) {
        throw new AppError('只能查看自己的薪資')
      }
      q = q.eq('user_id', uid)
    } else if (actor.role !== 'boss') {
      q = q.eq('user_id', actor.id)
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入薪資明細'))
    return (data ?? []).map((row) => mapSalaryEntry(row))
  },

  async createSalaryEntry(
    actor: AppUser,
    input: {
      userId: string
      userName: string
      entryDate: string
      category: SalaryEntryCategory
      amount: number
      title: string
      note?: string | null
      siteId?: string | null
      siteName?: string | null
      status?: SalaryEntryStatus
    },
  ): Promise<SalaryEntry> {
    assertBossSalaryAction(actor.role)
    const uid = requireUuid(input.userId, '使用者')
    const category = assertSalaryCategory(input.category)
    const amount = assertSalaryAmount(input.amount, category)
    const entryDate = input.entryDate.slice(0, 10)
    const { year, month } = periodFromDate(entryDate)
    const title = input.title.trim()
    if (!title) throw new AppError('請填項目名稱')
    const status = input.status ?? 'pending'
    const { data, error } = await sb()
      .from('salary_entries')
      .insert({
        user_id: uid,
        user_name: input.userName.trim() || '員工',
        period_year: year,
        period_month: month,
        entry_date: entryDate,
        category,
        amount,
        title,
        note: input.note?.trim() || null,
        site_id: input.siteId || null,
        site_name: input.siteName?.trim() || null,
        status,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增薪資項目'))
    const row = mapSalaryEntry(data)
    await this.appendAuditLog(actor, {
      action: 'salary.entry.create',
      targetType: 'salary_entry',
      targetId: row.id,
      after: row,
    })
    return row
  },

  async updateSalaryEntryStatus(
    actor: AppUser,
    input: {
      id: string
      status: 'confirmed' | 'paid' | 'cancelled' | 'pending'
      reason?: string | null
    },
  ): Promise<SalaryEntry> {
    assertBossSalaryAction(actor.role)
    const id = requireUuid(input.id, '薪資項目')
    const { data: current, error: loadError } = await sb()
      .from('salary_entries')
      .select(
        'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at',
      )
      .eq('id', id)
      .single()
    if (loadError || !current) {
      throw new AppError(toUserMessage(loadError, '找不到薪資項目'))
    }
    const before = mapSalaryEntry(current)
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = {
      status: input.status,
      updated_at: now,
    }
    if (input.status === 'confirmed') {
      if (!canConfirmSalaryEntry(before.status)) {
        throw new AppError('此狀態不可確認')
      }
      patch.confirmed_by = actor.id
      patch.confirmed_at = now
    } else if (input.status === 'paid') {
      if (!canMarkSalaryPaid(before.status)) {
        throw new AppError('僅已確認項目可標記支付')
      }
      patch.paid_by = actor.id
      patch.paid_at = now
    } else if (input.status === 'cancelled') {
      patch.cancelled_by = actor.id
      patch.cancelled_at = now
      patch.cancel_reason = input.reason?.trim() || null
    } else if (input.status === 'pending') {
      if (before.status === 'confirmed' || before.status === 'paid') {
        throw new AppError('已確認／已支付不可直接退回；請用更正')
      }
    }
    const { data, error } = await sb()
      .from('salary_entries')
      .update(patch)
      .eq('id', id)
      .select(
        'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新薪資狀態'))
    const row = mapSalaryEntry(data)
    await this.appendAuditLog(actor, {
      action: `salary.entry.${input.status}`,
      targetType: 'salary_entry',
      targetId: row.id,
      before,
      after: row,
    })
    return row
  },

  async correctSalaryEntry(
    actor: AppUser,
    input: {
      id: string
      amount: number
      title?: string
      note?: string | null
      reason: string
    },
  ): Promise<SalaryEntry> {
    assertBossSalaryAction(actor.role)
    const id = requireUuid(input.id, '薪資項目')
    const reason = assertCorrectionReason(input.reason)
    const { data: current, error: loadError } = await sb()
      .from('salary_entries')
      .select(
        'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at',
      )
      .eq('id', id)
      .single()
    if (loadError || !current) {
      throw new AppError(toUserMessage(loadError, '找不到薪資項目'))
    }
    const before = mapSalaryEntry(current)
    if (before.status !== 'confirmed' && before.status !== 'paid') {
      throw new AppError('僅已確認／已支付項目需走更正流程')
    }
    const amount = assertSalaryAmount(input.amount, before.category)
    const patch = {
      amount,
      title: input.title?.trim() || before.title,
      note: input.note !== undefined ? input.note?.trim() || null : before.note,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await sb()
      .from('salary_entries')
      .update(patch)
      .eq('id', id)
      .select(
        'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更正薪資'))
    const after = mapSalaryEntry(data)
    const { error: corrError } = await sb()
      .from('salary_entry_corrections')
      .insert({
        salary_entry_id: id,
        before_json: JSON.stringify(before),
        after_json: JSON.stringify(after),
        reason,
        corrected_by: actor.id,
      })
    if (corrError) {
      throw new AppError(toUserMessage(corrError, '更正紀錄寫入失敗'))
    }
    await this.appendAuditLog(actor, {
      action: 'salary.entry.correct',
      targetType: 'salary_entry',
      targetId: id,
      before,
      after,
      message: reason,
    })
    return after
  },

  async clockIn(input: {
    userId: string
    latitude?: number | null
    longitude?: number | null
  }): Promise<AttendanceRecord> {
    const userId = requireUuid(input.userId, '使用者')
    const open = await this.getOpenAttendance(userId)
    if (open) throw new AppError('目前已在上班中，請先下班')

    const { data, error } = await sb()
      .from('attendance')
      .insert({
        user_id: userId,
        status: 'clocked_in',
        clock_in_at: new Date().toISOString(),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      })
      .select(
        'id, organization_id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '上班打卡失敗'))
    const record = mapAttendance(data)
    void safeNotifyApprovers({
      eventType: 'attendance.clock_in',
      title: '出勤：上班打卡',
      detail: `成員已上班（${formatTaipei(new Date(record.clockInAt), 'HH:mm')}）`,
      href: '/team',
      asTodo: false,
    })
    return record
  },

  async clockOut(userId: string): Promise<AttendanceRecord> {
    const uid = requireUuid(userId, '使用者')
    const open = await this.getOpenAttendance(uid)
    if (!open) throw new AppError('目前沒有進行中的班次')

    const { data, error } = await sb()
      .from('attendance')
      .update({
        status: 'clocked_out',
        clock_out_at: new Date().toISOString(),
      })
      .eq('id', open.id)
      .eq('user_id', uid)
      .select(
        'id, organization_id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '下班打卡失敗'))
    const record = mapAttendance(data)
    void safeNotifyApprovers({
      eventType: 'attendance.clock_out',
      title: '出勤：下班打卡',
      detail: `成員已下班（${formatTaipei(new Date(record.clockOutAt ?? new Date()), 'HH:mm')}）`,
      href: '/team',
      asTodo: false,
    })
    return record
  },

  async assignSite(userId: string, siteId: string): Promise<AttendanceRecord> {
    const uid = requireUuid(userId, '使用者')
    const sid = requireUuid(siteId, '工地')
    const open = await this.getOpenAttendance(uid)
    if (!open) throw new AppError('請先上班再選擇工地')

    const { data, error } = await sb()
      .from('attendance')
      .update({ site_id: sid, job_type: 'project' })
      .eq('id', open.id)
      .eq('user_id', uid)
      .select(
        'id, organization_id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新目前工地'))
    const record = mapAttendance(data)

    // Each site pick appends a visit row (do not only overwrite attendance.site_id).
    const { data: siteRow } = await sb()
      .from('sites')
      .select('name')
      .eq('id', sid)
      .maybeSingle()
    const siteName = siteRow?.name ? String(siteRow.name) : null
    const { error: visitError } = await sb().from('location_checkins').insert({
      organization_id: record.organizationId,
      user_id: uid,
      recorded_at: new Date().toISOString(),
      source: 'attendance_site',
      site_id: sid,
      label: siteName,
      attendance_id: open.id,
    })
    if (visitError) {
      console.warn('[assignSite] visit insert failed', visitError.message)
    }
    return record
  },

  async listAttendanceCorrections(actor: AppUser): Promise<AttendanceCorrection[]> {
    requireUuid(actor.id, '使用者')
    let query = sb()
      .from('attendance_corrections')
      .select(ATTENDANCE_CORRECTION_COLS)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!hasPermission(actor.role, PERMISSIONS.ATTENDANCE_CORRECT_APPROVE)) {
      query = query.eq('user_id', actor.id)
    }

    const { data, error } = await query
    if (error) throw new AppError(toUserMessage(error, '無法載入補打卡申請'))
    return (data ?? []).map((row) => mapAttendanceCorrection(row))
  },

  async listPendingAttendanceCorrections(
    actor: AppUser,
  ): Promise<AttendanceCorrection[]> {
    assertPermission(actor.role, PERMISSIONS.ATTENDANCE_CORRECT_APPROVE)
    const { data, error } = await sb()
      .from('attendance_corrections')
      .select(ATTENDANCE_CORRECTION_COLS)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)
    if (error) throw new AppError(toUserMessage(error, '無法載入待核准補打卡'))
    return (data ?? [])
      .map((row) => mapAttendanceCorrection(row))
      .filter((c) => c.userId !== actor.id)
  },

  async applyAttendanceCorrection(
    actor: AppUser,
    input: {
      attendanceId?: string | null
      proposedClockInAt: string
      proposedClockOutAt?: string | null
      proposedSiteId?: string | null
      reason: string
    },
  ): Promise<AttendanceCorrection> {
    assertPermission(actor.role, PERMISSIONS.ATTENDANCE_OWN)
    const reason = input.reason.trim()
    if (reason.length < 2) throw new AppError('請填寫補打卡原因')

    const clockIn = new Date(input.proposedClockInAt)
    if (Number.isNaN(clockIn.getTime())) throw new AppError('上班時間無效')
    let clockOutIso: string | null = null
    if (input.proposedClockOutAt) {
      const clockOut = new Date(input.proposedClockOutAt)
      if (Number.isNaN(clockOut.getTime())) throw new AppError('下班時間無效')
      if (clockOut.getTime() < clockIn.getTime()) {
        throw new AppError('下班時間不可早於上班時間')
      }
      clockOutIso = clockOut.toISOString()
    }

    const attendanceId = optionalUuid(input.attendanceId ?? '', '出勤')
    const proposedSiteId = optionalUuid(input.proposedSiteId ?? '', '工地')

    let originalClockInAt: string | null = null
    let originalClockOutAt: string | null = null
    let originalSiteId: string | null = null

    if (attendanceId) {
      const { data: att, error: attError } = await sb()
        .from('attendance')
        .select(
          'id, organization_id, user_id, clock_in_at, clock_out_at, site_id',
        )
        .eq('id', attendanceId)
        .maybeSingle()
      if (attError) throw new AppError(toUserMessage(attError, '無法讀取出勤'))
      if (!att) throw new AppError('找不到出勤紀錄')
      if (String(att.user_id) !== actor.id) {
        throw new AppError('只能更正自己的出勤')
      }
      assertSameOrganization(actor.organizationId, String(att.organization_id))
      originalClockInAt = String(att.clock_in_at)
      originalClockOutAt = (att.clock_out_at as string | null) ?? null
      originalSiteId = (att.site_id as string | null) ?? null
    }

    const { data, error } = await sb()
      .from('attendance_corrections')
      .insert({
        organization_id: actor.organizationId,
        user_id: actor.id,
        attendance_id: attendanceId,
        proposed_clock_in_at: clockIn.toISOString(),
        proposed_clock_out_at: clockOutIso,
        proposed_site_id: proposedSiteId,
        reason,
        status: 'pending',
        original_clock_in_at: originalClockInAt,
        original_clock_out_at: originalClockOutAt,
        original_site_id: originalSiteId,
      })
      .select(ATTENDANCE_CORRECTION_COLS)
      .single()
    if (error) throw new AppError(toUserMessage(error, '補打卡申請失敗'))

    const correction = mapAttendanceCorrection(data)
    void safeNotifyApprovers({
      eventType: 'attendance.correction_pending',
      title: `補打卡待核准：${actor.name}`,
      detail: reason,
      href: '/attendance',
      asTodo: true,
    })
    return correction
  },

  async approveAttendanceCorrection(
    actor: AppUser,
    correctionId: string,
  ): Promise<AttendanceCorrection> {
    const id = requireUuid(correctionId, '補打卡')
    const { data: current, error: loadError } = await sb()
      .from('attendance_corrections')
      .select(ATTENDANCE_CORRECTION_COLS)
      .eq('id', id)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取補打卡'))
    if (!current) throw new AppError('找不到補打卡申請')
    if (current.status !== 'pending') throw new AppError('此申請不在待核准狀態')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    assertCanApproveAttendanceCorrection({
      actorRole: actor.role,
      actorId: actor.id,
      requesterId: String(current.user_id),
    })

    const effectiveIn = String(current.proposed_clock_in_at)
    const effectiveOut = (current.proposed_clock_out_at as string | null) ?? null
    const effectiveSite =
      (current.proposed_site_id as string | null) ?? null
    const attendanceId = (current.attendance_id as string | null) ?? null

    // Approve → overwrite linked attendance (or create one if 漏打補登).
    if (attendanceId) {
      const { error: attError } = await sb()
        .from('attendance')
        .update({
          clock_in_at: effectiveIn,
          clock_out_at: effectiveOut,
          site_id: effectiveSite,
          status: effectiveOut ? 'clocked_out' : 'clocked_in',
        })
        .eq('id', attendanceId)
        .eq('organization_id', actor.organizationId)
      if (attError) {
        throw new AppError(toUserMessage(attError, '核准後無法覆蓋出勤'))
      }
    } else {
      const { error: createError } = await sb()
        .from('attendance')
        .insert({
          organization_id: actor.organizationId,
          user_id: current.user_id,
          clock_in_at: effectiveIn,
          clock_out_at: effectiveOut,
          site_id: effectiveSite,
          status: effectiveOut ? 'clocked_out' : 'clocked_in',
          job_type: 'project',
        })
      if (createError) {
        throw new AppError(toUserMessage(createError, '核准後無法建立出勤'))
      }
    }

    const { data, error } = await sb()
      .from('attendance_corrections')
      .update({
        status: 'approved',
        effective_clock_in_at: effectiveIn,
        effective_clock_out_at: effectiveOut,
        effective_site_id: effectiveSite,
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select(ATTENDANCE_CORRECTION_COLS)
      .single()
    if (error) throw new AppError(toUserMessage(error, '核准補打卡失敗'))

    const correction = mapAttendanceCorrection(data)
    void safeNotify({
      recipientIds: [correction.userId],
      eventType: 'attendance.correction_approved',
      title: '補打卡已核准',
      detail: correction.reason,
      href: '/attendance',
      asTodo: false,
    })
    return correction
  },

  async rejectAttendanceCorrection(
    actor: AppUser,
    correctionId: string,
    reason: string,
  ): Promise<AttendanceCorrection> {
    const id = requireUuid(correctionId, '補打卡')
    const trimmed = reason.trim()
    if (!trimmed) throw new AppError('駁回必須填寫原因')

    const { data: current, error: loadError } = await sb()
      .from('attendance_corrections')
      .select(ATTENDANCE_CORRECTION_COLS)
      .eq('id', id)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取補打卡'))
    if (!current) throw new AppError('找不到補打卡申請')
    if (current.status !== 'pending') throw new AppError('此申請不在待核准狀態')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    assertCanApproveAttendanceCorrection({
      actorRole: actor.role,
      actorId: actor.id,
      requesterId: String(current.user_id),
    })

    const { data, error } = await sb()
      .from('attendance_corrections')
      .update({
        status: 'rejected',
        review_note: trimmed,
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select(ATTENDANCE_CORRECTION_COLS)
      .single()
    if (error) throw new AppError(toUserMessage(error, '駁回補打卡失敗'))

    const correction = mapAttendanceCorrection(data)
    void safeNotify({
      recipientIds: [correction.userId],
      eventType: 'attendance.correction_rejected',
      title: '補打卡已駁回',
      detail: trimmed,
      href: '/attendance',
      asTodo: false,
    })
    return correction
  },

  async listPurchases(actor: AppUser): Promise<PurchaseRecord[]> {
    let query = sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .order('created_at', { ascending: false })

    if (!hasPermission(actor.role, PERMISSIONS.PURCHASE_APPROVE)) {
      query = query.eq('user_id', actor.id)
    }

    const { data, error } = await query
    if (error) throw new AppError(toUserMessage(error, '無法載入採購列表'))
    return (data ?? []).map((row) => mapPurchase(row))
  },

  async listPendingPurchases(actor: AppUser): Promise<PurchaseRecord[]> {
    assertPermission(actor.role, PERMISSIONS.PURCHASE_APPROVE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const { data, error } = await sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入待核准採購'))
    return (data ?? [])
      .map((row) => mapPurchase(row))
      .filter((p) => {
        try {
          assertSameOrganization(actor.organizationId, p.organizationId)
          return true
        } catch {
          return false
        }
      })
  },

  async emergencyUsedToday(userId: string, businessDate?: string): Promise<number> {
    requireUuid(userId, '使用者')
    const day = businessDate ?? formatTaipei(new Date(), 'yyyy-MM-dd')
    const { data, error } = await sb()
      .from('emergency_limit_events')
      .select('amount_delta')
      .eq('employee_id', userId)
      .eq('business_date', day)
    if (error) throw new AppError(toUserMessage(error, '無法讀取緊急額度'))
    return sumOccupiedQuota(
      (data ?? []).map((row, i) => ({
        id: String(i),
        organizationId: '',
        employeeId: userId,
        businessDate: day,
        type: 'RESERVE',
        amountDelta: Number(row.amount_delta),
        createdAt: '',
        createdBy: '',
      })),
    )
  },

  async createPurchase(
    actor: AppUser,
    input: {
      title: string
      mode: PurchaseMode
      siteId?: string
      goodsAmount: number
      discount?: number
      tax?: number
      shipping?: number
      otherBuyerFees?: number
    },
  ): Promise<PurchaseRecord> {
    assertPermission(actor.role, PERMISSIONS.PURCHASE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const siteId = optionalUuid(input.siteId, '工地')
    const finalPayable = calcFinalPayable(input)
    const businessDate = formatTaipei(new Date(), 'yyyy-MM-dd')
    const settings = await this.getOrgSpendSettings(actor)
    const needsApproval =
      input.mode === 'normal' &&
      requiresBossReview(finalPayable, settings.reportReviewThresholdNtd)

    const dayPurchases = (await this.listPurchases(actor)).filter(
      (p) =>
        p.userId === actor.id &&
        p.businessDate === businessDate &&
        p.status !== 'rejected' &&
        p.status !== 'cancelled',
    )
    const usedToday = dayPurchases.reduce((s, p) => s + p.finalPayable, 0)
    assertWithinDailyPurchaseLimit({
      usedTodayNtd: usedToday,
      nextAmount: finalPayable,
      dailyPurchaseLimitNtd: settings.dailyPurchaseLimitNtd,
    })

    if (input.mode === 'emergency') {
      const used = await this.emergencyUsedToday(actor.id, businessDate)
      assertEmergencyReserveAllowed({
        eventsForDay: [
          {
            id: 'sum',
            organizationId: actor.organizationId,
            employeeId: actor.id,
            businessDate,
            type: 'RESERVE',
            amountDelta: used,
            createdAt: '',
            createdBy: actor.id,
          },
        ],
        reserveAmount: finalPayable,
        singleLimit: settings.emergencySingleLimitNtd,
        dailyLimit: settings.emergencyDailyLimitNtd,
      })
    }

    const { data, error } = await sb()
      .from('purchases')
      .insert({
        user_id: actor.id,
        site_id: siteId,
        mode: input.mode,
        status: needsApproval ? 'pending_approval' : 'purchased',
        title: input.title.trim(),
        goods_amount: input.goodsAmount,
        discount: input.discount ?? 0,
        tax: input.tax ?? 0,
        shipping: input.shipping ?? 0,
        other_buyer_fees: input.otherBuyerFees ?? 0,
        final_payable: finalPayable,
        business_date: businessDate,
      })
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立採購'))

    const purchase = mapPurchase(data)

    if (input.mode === 'emergency') {
      const { error: eventError } = await sb().from('emergency_limit_events').insert({
        employee_id: actor.id,
        business_date: businessDate,
        event_type: 'RESERVE',
        amount_delta: finalPayable,
        purchase_id: purchase.id,
        reason: '緊急採購占額',
        created_by: actor.id,
      })
      if (eventError) {
        throw new AppError(toUserMessage(eventError, '緊急額度占額失敗'))
      }
    }

    if (needsApproval) {
      void safeNotifyApprovers({
        eventType: 'purchase.pending',
        title: `採購待核准：${purchase.title}`,
        detail: `最終應付 NT$${finalPayable.toLocaleString()}`,
        href: '/purchases',
        asTodo: true,
      })
    }

    return purchase
  },

  async approvePurchase(actor: AppUser, purchaseId: string): Promise<PurchaseRecord> {
    const pid = requireUuid(purchaseId, '採購')
    const { data: current, error: loadError } = await sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .eq('id', pid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取採購'))
    if (!current) throw new AppError('找不到採購')
    if (current.status !== 'pending_approval') throw new AppError('此採購不在待核准狀態')
    assertSameOrganization(actor.organizationId, String(current.organization_id))

    assertCanApprovePurchase({
      actorRole: actor.role,
      actorId: actor.id,
      requesterId: String(current.user_id),
    })

    const { data, error } = await sb()
      .from('purchases')
      .update({
        status: 'approved',
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', pid)
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '核准失敗'))
    const purchase = mapPurchase(data)
    void safeNotify({
      recipientIds: [purchase.userId],
      eventType: 'purchase.approved',
      title: `採購已核准：${purchase.title}`,
      detail: `最終應付 NT$${purchase.finalPayable.toLocaleString()}`,
      href: '/purchases',
      asTodo: false,
    })
    return purchase
  },

  async rejectPurchase(
    actor: AppUser,
    purchaseId: string,
    reason: string,
  ): Promise<PurchaseRecord> {
    const pid = requireUuid(purchaseId, '採購')
    const { data: current, error: loadError } = await sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .eq('id', pid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取採購'))
    if (!current) throw new AppError('找不到採購')
    if (current.status !== 'pending_approval') throw new AppError('此採購不在待核准狀態')
    assertSameOrganization(actor.organizationId, String(current.organization_id))

    assertCanApprovePurchase({
      actorRole: actor.role,
      actorId: actor.id,
      requesterId: String(current.user_id),
    })

    const trimmed = reason.trim()
    if (!trimmed) throw new AppError('駁回必須填寫原因')

    const { data, error } = await sb()
      .from('purchases')
      .update({
        status: 'rejected',
        rejected_reason: trimmed,
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', pid)
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '駁回失敗'))

    if (current.mode === 'emergency') {
      const { error: eventError } = await sb().from('emergency_limit_events').insert({
        employee_id: current.user_id,
        business_date: current.business_date,
        event_type: 'RELEASE',
        amount_delta: -Number(current.final_payable),
        purchase_id: pid,
        reason: `駁回釋放：${trimmed}`,
        created_by: actor.id,
      })
      if (eventError) throw new AppError(toUserMessage(eventError, '額度釋放失敗'))
    }

    const purchase = mapPurchase(data)
    void safeNotify({
      recipientIds: [purchase.userId],
      eventType: 'purchase.rejected',
      title: `採購已駁回：${purchase.title}`,
      detail: trimmed,
      href: '/purchases',
      asTodo: false,
    })
    return purchase
  },

  async cancelEmergencyPurchase(
    actor: AppUser,
    purchaseId: string,
    reason: string,
  ): Promise<PurchaseRecord> {
    const pid = requireUuid(purchaseId, '採購')
    const { data: current, error: loadError } = await sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .eq('id', pid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取採購'))
    if (!current) throw new AppError('找不到採購')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    if (current.mode !== 'emergency') throw new AppError('僅緊急採購可走額度釋放')
    if (current.status === 'cancelled') throw new AppError('已取消')
    if (
      !hasPermission(actor.role, PERMISSIONS.PURCHASE_APPROVE) &&
      actor.id !== current.user_id
    ) {
      throw new AppError('無權取消此緊急採購')
    }

    const { data, error } = await sb()
      .from('purchases')
      .update({
        status: 'cancelled',
        rejected_reason: reason,
      })
      .eq('id', pid)
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '取消失敗'))

    const { error: eventError } = await sb().from('emergency_limit_events').insert({
      employee_id: current.user_id,
      business_date: current.business_date,
      event_type: 'RELEASE',
      amount_delta: -Number(current.final_payable),
      purchase_id: pid,
      reason,
      created_by: actor.id,
    })
    if (eventError) throw new AppError(toUserMessage(eventError, '額度釋放失敗'))

    return mapPurchase(data)
  },

  async listRepairCases(): Promise<RepairCase[]> {
    const { data, error } = await sb()
      .from('repair_cases')
      .select(
        'id, organization_id, case_number, problem_description, title, status, site_id, customer_id, customer_name, created_at, updated_at, created_by',
      )
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入維修案件'))
    return (data ?? []).map((row) =>
      mapRepairCaseRow(row as Record<string, unknown>),
    )
  },

  async listQuotations(): Promise<Quotation[]> {
    const { data, error } = await sb()
      .from('quotations')
      .select(QUOTE_SELECT)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入報價'))
    return (data ?? []).map((row) =>
      mapQuotationRow(row as Record<string, unknown>),
    )
  },

  async getQuotation(quoteId: string): Promise<Quotation> {
    const qid = requireUuid(quoteId, '報價')
    const { data, error } = await sb()
      .from('quotations')
      .select(QUOTE_SELECT)
      .eq('id', qid)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw new AppError(toUserMessage(error, '無法讀取報價'))
    if (!data) throw new AppError('找不到報價')
    return mapQuotationRow(data as Record<string, unknown>)
  },

  async createQuotation(
    actor: AppUser,
    input: {
      title: string
      projectId?: string | null
      repairCaseId?: string | null
      taxMode: TaxMode
      customerName?: string
      siteAddress?: string
      paymentTerms?: string
      validUntil?: string | null
      notes?: string
      discount?: number
    },
  ): Promise<Quotation> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const projectId = optionalUuid(input.projectId, '工程')
    const repairCaseId = optionalUuid(input.repairCaseId, '維修案件')
    assertQuoteAssociation({ projectId, repairCaseId })
    if (!input.taxMode) throw new AppError('建立報價必須選擇稅務模式（REV-03）')
    const taxRate = input.taxMode === 'zero' ? 0 : 0.05
    const quoteNumber = `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`

    const { data, error } = await sb()
      .from('quotations')
      .insert({
        project_id: projectId,
        repair_case_id: repairCaseId,
        title: input.title.trim(),
        status: 'draft',
        workflow_status: 'editing',
        quote_number: quoteNumber,
        customer_name: (input.customerName || '').trim(),
        site_address: (input.siteAddress || '').trim(),
        tax_mode: input.taxMode,
        tax_rate: taxRate,
        amount_before_tax: 0,
        discount: Number(input.discount ?? 0) || 0,
        tax_amount: 0,
        amount_after_tax: 0,
        notes: input.notes ?? null,
        payment_terms: input.paymentTerms ?? '依約定',
        valid_until: input.validUntil ?? null,
        current_version: 0,
        frozen: false,
        created_by: actor.id,
      })
      .select(QUOTE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立報價'))
    const quote = mapQuotationRow(data as Record<string, unknown>)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    return quote
  },

  async updateQuotationMeta(
    actor: AppUser,
    quoteId: string,
    patch: Partial<{
      title: string
      customerName: string
      siteAddress: string
      taxMode: TaxMode
      discount: number
      notes: string | null
      paymentTerms: string | null
      validUntil: string | null
    }>,
  ): Promise<Quotation> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const current = await this.getQuotation(quoteId)
    assertSameOrganization(actor.organizationId, current.organizationId)
    assertQuoteDraftEditable({ workflowStatus: current.workflowStatus })
    const nextWs =
      current.workflowStatus === 'exported' ||
      current.workflowStatus === 'sent_to_customer'
        ? 'editing'
        : current.workflowStatus
    const { data, error } = await sb()
      .from('quotations')
      .update({
        title: patch.title ?? current.title,
        customer_name: patch.customerName ?? current.customerName,
        site_address: patch.siteAddress ?? current.siteAddress,
        tax_mode: patch.taxMode ?? current.taxMode,
        discount: patch.discount ?? current.discount,
        notes: patch.notes === undefined ? current.notes : patch.notes,
        payment_terms:
          patch.paymentTerms === undefined
            ? current.paymentTerms
            : patch.paymentTerms,
        valid_until:
          patch.validUntil === undefined ? current.validUntil : patch.validUntil,
        workflow_status: nextWs,
        status: legacyStatusFromWorkflow(nextWs),
      })
      .eq('id', quoteId)
      .select(QUOTE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新報價'))
    return mapQuotationRow(data as Record<string, unknown>)
  },

  /** Export creates immutable version snapshot (primary formal action). */
  async exportQuotationVersion(
    actor: AppUser,
    quoteId: string,
    format: QuoteExportFormat = 'snapshot',
  ): Promise<{ quote: Quotation; version: QuotationVersion }> {
    assertCanExportQuote(actor.role)
    const qid = requireUuid(quoteId, '報價')
    const current = await this.getQuotation(qid)
    assertSameOrganization(actor.organizationId, current.organizationId)
    if (current.workflowStatus === 'cancelled') {
      throw new AppError('已取消報價不可匯出')
    }
    const items = await this.listQuotationItems(qid)
    const versionNo = current.currentVersion + 1
    const snapshot = buildQuoteExportSnapshot({
      quote: current,
      items,
      versionNo,
    })
    const { data: ver, error: verErr } = await sb()
      .from('quotation_versions')
      .insert({
        quotation_id: qid,
        version_no: versionNo,
        quote_number: current.quoteNumber,
        snapshot,
        exported_by: actor.id,
        export_format: format,
      })
      .select(
        'id, organization_id, quotation_id, version_no, quote_number, snapshot, exported_at, exported_by, export_format',
      )
      .single()
    if (verErr) throw new AppError(toUserMessage(verErr, '無法建立匯出版本'))

    const { data, error } = await sb()
      .from('quotations')
      .update({
        current_version: versionNo,
        last_exported_at: ver.exported_at,
        workflow_status: 'exported',
        status: 'published',
        published_at: ver.exported_at,
      })
      .eq('id', qid)
      .select(QUOTE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新報價狀態'))

    const quote = mapQuotationRow(data as Record<string, unknown>)
    const version: QuotationVersion = {
      id: String(ver.id),
      organizationId: String(ver.organization_id),
      quotationId: String(ver.quotation_id),
      versionNo: Number(ver.version_no),
      quoteNumber: String(ver.quote_number),
      snapshot: ver.snapshot as QuoteExportSnapshot,
      exportedAt: String(ver.exported_at),
      exportedBy: (ver.exported_by as string | null) ?? null,
      exportFormat: ver.export_format as QuoteExportFormat,
    }
    if (quote.createdBy) {
      void safeNotify({
        recipientIds: [quote.createdBy],
        eventType: 'quote.published',
        title: `報價已匯出：${quote.title}`,
        detail: `${quote.quoteNumber} v${versionNo} · NT$${quote.amountAfterTax.toLocaleString()}`,
        href: `/quotes/${quote.id}`,
        asTodo: false,
      })
    }
    return { quote, version }
  },

  /** @deprecated Prefer exportQuotationVersion */
  async publishQuotation(actor: AppUser, quoteId: string): Promise<Quotation> {
    return (await this.exportQuotationVersion(actor, quoteId, 'snapshot')).quote
  },

  async setQuoteWorkflowStatus(
    actor: AppUser,
    quoteId: string,
    workflowStatus: QuoteWorkflowStatus,
  ): Promise<Quotation> {
    if (
      workflowStatus === 'accepted' ||
      workflowStatus === 'rejected' ||
      workflowStatus === 'sent_to_customer'
    ) {
      assertCanMarkQuoteAccept(actor.role)
    }
    const current = await this.getQuotation(quoteId)
    assertSameOrganization(actor.organizationId, current.organizationId)
    if (
      workflowStatus === 'accepted' &&
      current.workflowStatus !== 'exported' &&
      current.workflowStatus !== 'sent_to_customer' &&
      current.workflowStatus !== 'rejected'
    ) {
      throw new AppError('請先匯出或提供客戶後再標記接受')
    }
    const { data, error } = await sb()
      .from('quotations')
      .update({
        workflow_status: workflowStatus,
        status: legacyStatusFromWorkflow(workflowStatus),
      })
      .eq('id', quoteId)
      .select(QUOTE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新狀態'))
    return mapQuotationRow(data as Record<string, unknown>)
  },

  async listQuotationVersions(quotationId: string): Promise<QuotationVersion[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('quotation_versions')
      .select(
        'id, organization_id, quotation_id, version_no, quote_number, snapshot, exported_at, exported_by, export_format, deleted_at, deleted_by, delete_reason',
      )
      .eq('quotation_id', qid)
      .is('deleted_at', null)
      .order('version_no', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入版本'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      quotationId: String(row.quotation_id),
      versionNo: Number(row.version_no),
      quoteNumber: String(row.quote_number),
      snapshot: row.snapshot as QuoteExportSnapshot,
      exportedAt: String(row.exported_at),
      exportedBy: (row.exported_by as string | null) ?? null,
      exportFormat: row.export_format as QuoteExportFormat,
      deletedAt: (row.deleted_at as string | null) ?? null,
      deletedBy: (row.deleted_by as string | null) ?? null,
      deleteReason: (row.delete_reason as string | null) ?? null,
    }))
  },

  async softDeleteQuotationVersion(
    actor: AppUser,
    versionId: string,
    reason?: string,
  ): Promise<void> {
    const vid = requireUuid(versionId, '報價版本')
    const { data: ver, error: loadError } = await sb()
      .from('quotation_versions')
      .select(
        'id, organization_id, quotation_id, version_no, deleted_at',
      )
      .eq('id', vid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取版本'))
    if (!ver) throw new AppError('找不到版本')
    assertSameOrganization(actor.organizationId, String(ver.organization_id))
    const quote = await this.getQuotation(String(ver.quotation_id))
    assertCanSoftDeleteQuoteVersion(actor.role, quote, {
      versionNo: Number(ver.version_no),
      deletedAt: (ver.deleted_at as string | null) ?? null,
    })
    const { error } = await sb()
      .from('quotation_versions')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: actor.id,
        delete_reason: reason?.trim() || '使用者刪除歷史版本',
      })
      .eq('id', vid)
      .is('deleted_at', null)
    if (error) throw new AppError(toUserMessage(error, '刪除版本失敗'))
  },

  async softDeleteQuotation(
    actor: AppUser,
    quoteId: string,
    reason?: string,
  ): Promise<void> {
    const quote = await this.getQuotation(quoteId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    assertCanSoftDeleteQuoteCase(actor.role, quote)
    const now = new Date().toISOString()
    const { error } = await sb()
      .from('quotations')
      .update({
        deleted_at: now,
        deleted_by: actor.id,
        delete_reason: reason?.trim() || '使用者刪除報價案件',
      })
      .eq('id', quoteId)
      .is('deleted_at', null)
    if (error) throw new AppError(toUserMessage(error, '刪除案件失敗'))
    // Hide versions with soft-delete (audit retained)
    await sb()
      .from('quotation_versions')
      .update({
        deleted_at: now,
        deleted_by: actor.id,
        delete_reason: '隨案件刪除而隱藏',
      })
      .eq('quotation_id', quoteId)
      .is('deleted_at', null)
  },

  async listChangeOrders(quotationId?: string): Promise<ChangeOrder[]> {
    let q = sb()
      .from('change_orders')
      .select(
        'id, organization_id, quotation_id, change_number, kind, title, status, tax_mode, tax_rate, amount_before_tax, discount, tax_amount, amount_after_tax, notes, accepted_at, accepted_by, created_at, updated_at, created_by',
      )
      .order('updated_at', { ascending: false })
    if (quotationId) {
      q = q.eq('quotation_id', requireUuid(quotationId, '報價'))
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入追加減'))
    return (data ?? []).map((row) => mapChangeOrderRow(row as Record<string, unknown>))
  },

  async getChangeOrder(changeOrderId: string): Promise<ChangeOrder> {
    const id = requireUuid(changeOrderId, '追加減')
    const { data, error } = await sb()
      .from('change_orders')
      .select(
        'id, organization_id, quotation_id, change_number, kind, title, status, tax_mode, tax_rate, amount_before_tax, discount, tax_amount, amount_after_tax, notes, accepted_at, accepted_by, created_at, updated_at, created_by',
      )
      .eq('id', id)
      .maybeSingle()
    if (error) throw new AppError(toUserMessage(error, '無法讀取追加減'))
    if (!data) throw new AppError('找不到追加減')
    return mapChangeOrderRow(data as Record<string, unknown>)
  },

  async listChangeOrderItems(changeOrderId: string): Promise<ChangeOrderItem[]> {
    const cid = requireUuid(changeOrderId, '追加減')
    const { data, error } = await sb()
      .from('change_order_items')
      .select(
        'id, organization_id, change_order_id, line_no, kind, description, qty, unit, unit_price, amount, created_at, updated_at',
      )
      .eq('change_order_id', cid)
      .order('line_no', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入追加減細項'))
    return (data ?? []).map((row) => mapChangeOrderItemRow(row as Record<string, unknown>))
  },

  async createChangeOrder(
    actor: AppUser,
    input: {
      quotationId: string
      kind: ChangeOrderKind
      title: string
      notes?: string
      discount?: number
    },
  ): Promise<ChangeOrder> {
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canCreateChangeOrder(actor.role, quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const changeNumber = `CO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('change_orders')
      .insert({
        quotation_id: quote.id,
        change_number: changeNumber,
        kind: input.kind,
        title: input.title.trim() || (input.kind === 'addition' ? '追加' : '追減'),
        status: 'draft',
        tax_mode: quote.taxMode,
        tax_rate: quote.taxRate,
        discount: Number(input.discount ?? 0) || 0,
        notes: input.notes ?? null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, quotation_id, change_number, kind, title, status, tax_mode, tax_rate, amount_before_tax, discount, tax_amount, amount_after_tax, notes, accepted_at, accepted_by, created_at, updated_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立追加減'))
    return mapChangeOrderRow(data as Record<string, unknown>)
  },

  async addChangeOrderItem(
    actor: AppUser,
    input: {
      changeOrderId: string
      kind: QuotationItemKind
      description: string
      qty: number
      unit?: string
      unitPrice: number
    },
  ): Promise<ChangeOrderItem> {
    const co = await this.getChangeOrder(input.changeOrderId)
    assertSameOrganization(actor.organizationId, co.organizationId)
    assertChangeOrderEditable({ status: co.status })
    if (!hasPermission(actor.role, PERMISSIONS.QUOTE_CREATE)) {
      throw new AppError('無權編輯追加減')
    }
    const existing = await this.listChangeOrderItems(co.id)
    const amount = calcQuoteItemAmount({
      qty: input.qty,
      unitPrice: input.unitPrice,
    })
    const { data, error } = await sb()
      .from('change_order_items')
      .insert({
        change_order_id: co.id,
        line_no: existing.length + 1,
        kind: input.kind,
        description: input.description.trim(),
        qty: input.qty,
        unit: input.unit || '式',
        unit_price: input.unitPrice,
        amount,
      })
      .select(
        'id, organization_id, change_order_id, line_no, kind, description, qty, unit, unit_price, amount, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增細項'))
    return mapChangeOrderItemRow(data as Record<string, unknown>)
  },

  async removeChangeOrderItem(actor: AppUser, itemId: string): Promise<void> {
    const iid = requireUuid(itemId, '細項')
    const { data: item, error: loadError } = await sb()
      .from('change_order_items')
      .select('id, organization_id, change_order_id')
      .eq('id', iid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取細項'))
    if (!item) throw new AppError('找不到細項')
    assertSameOrganization(actor.organizationId, String(item.organization_id))
    const co = await this.getChangeOrder(String(item.change_order_id))
    assertChangeOrderEditable({ status: co.status })
    if (!hasPermission(actor.role, PERMISSIONS.QUOTE_CREATE)) {
      throw new AppError('無權編輯追加減')
    }
    const { error } = await sb()
      .from('change_order_items')
      .delete()
      .eq('id', iid)
    if (error) throw new AppError(toUserMessage(error, '無法刪除細項'))
  },

  async setChangeOrderStatus(
    actor: AppUser,
    changeOrderId: string,
    status: ChangeOrderStatus,
  ): Promise<ChangeOrder> {
    if (
      status === 'accepted' ||
      status === 'rejected' ||
      status === 'sent_to_customer'
    ) {
      assertCanMarkChangeOrderAccept(actor.role)
    }
    const co = await this.getChangeOrder(changeOrderId)
    assertSameOrganization(actor.organizationId, co.organizationId)
    if (co.status === 'accepted' || co.status === 'cancelled') {
      throw new AppError('已接受或已取消的追加減不可再改狀態')
    }
    if (status === 'accepted') {
      const items = await this.listChangeOrderItems(co.id)
      if (items.length === 0) {
        throw new AppError('請先新增至少一筆細項再標記接受')
      }
    }
    const patch: Record<string, unknown> = { status }
    if (status === 'accepted') {
      patch.accepted_at = new Date().toISOString()
      patch.accepted_by = actor.id
    }
    const { data, error } = await sb()
      .from('change_orders')
      .update(patch)
      .eq('id', co.id)
      .select(
        'id, organization_id, quotation_id, change_number, kind, title, status, tax_mode, tax_rate, amount_before_tax, discount, tax_amount, amount_after_tax, notes, accepted_at, accepted_by, created_at, updated_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新追加減狀態'))
    return mapChangeOrderRow(data as Record<string, unknown>)
  },

  async listBillingMilestones(quotationId: string): Promise<BillingMilestone[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('billing_milestones')
      .select(BILLING_MILESTONE_SELECT)
      .eq('quotation_id', qid)
      .order('sequence', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入請款節點'))
    return (data ?? []).map((row) =>
      mapBillingMilestoneRow(row as Record<string, unknown>),
    )
  },

  async listBillingDocuments(quotationId?: string): Promise<BillingDocument[]> {
    let q = sb()
      .from('billing_documents')
      .select(BILLING_DOC_SELECT)
      .order('updated_at', { ascending: false })
    if (quotationId) {
      q = q.eq('quotation_id', requireUuid(quotationId, '報價'))
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入請款單'))
    return (data ?? []).map((row) =>
      mapBillingDocumentRow(row as Record<string, unknown>),
    )
  },

  async listBillingDocumentItems(
    documentId: string,
  ): Promise<BillingDocumentItem[]> {
    const did = requireUuid(documentId, '請款單')
    const { data, error } = await sb()
      .from('billing_document_items')
      .select(
        'id, organization_id, billing_document_id, line_no, description, qty, unit, unit_price, amount, created_at',
      )
      .eq('billing_document_id', did)
      .order('line_no', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入請款細項'))
    return (data ?? []).map((row) =>
      mapBillingDocumentItemRow(row as Record<string, unknown>),
    )
  },

  async createBillingMilestone(
    actor: AppUser,
    input: {
      quotationId: string
      code: string
      title: string
      plannedAmount: number
      sequence?: number
    },
  ): Promise<BillingMilestone> {
    assertCanManageBilling(actor.role)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canCreateBillingForQuote(quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const existing = await this.listBillingMilestones(quote.id)
    const code = input.code.trim().toUpperCase()
    if (!code) throw new AppError('請款節點代碼不可空白')
    if (existing.some((m) => m.code === code)) {
      throw new AppError('同一報價不可重複請款節點代碼')
    }
    const { data, error } = await sb()
      .from('billing_milestones')
      .insert({
        quotation_id: quote.id,
        code,
        title: input.title.trim() || code,
        sequence: input.sequence ?? existing.length + 1,
        planned_amount: Math.max(0, Number(input.plannedAmount) || 0),
        status: 'planned',
        created_by: actor.id,
      })
      .select(BILLING_MILESTONE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立請款節點'))
    return mapBillingMilestoneRow(data as Record<string, unknown>)
  },

  async createBillingDocument(
    actor: AppUser,
    input: {
      quotationId: string
      milestoneId: string
      title?: string
      notes?: string
    },
  ): Promise<BillingDocument> {
    assertCanManageBilling(actor.role)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canCreateBillingForQuote(quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const milestones = await this.listBillingMilestones(quote.id)
    const milestone = milestones.find((m) => m.id === input.milestoneId)
    if (!milestone) throw new AppError('找不到請款節點')
    if (milestone.status === 'cancelled') {
      throw new AppError('已取消的請款節點不可開立請款')
    }
    const docs = await this.listBillingDocuments(quote.id)
    if (docs.some((d) => d.milestoneId === milestone.id && d.status === 'issued')) {
      throw new AppError('此請款節點已有正式請款單，不得重複開立')
    }
    const documentNumber = `BILL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('billing_documents')
      .insert({
        quotation_id: quote.id,
        milestone_id: milestone.id,
        document_number: documentNumber,
        title: (input.title || milestone.title).trim(),
        status: 'draft',
        tax_mode: quote.taxMode,
        tax_rate: quote.taxRate,
        notes: input.notes ?? null,
        created_by: actor.id,
      })
      .select(BILLING_DOC_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立請款單'))
    const doc = mapBillingDocumentRow(data as Record<string, unknown>)
    if (milestone.plannedAmount > 0) {
      await this.addBillingDocumentItem(actor, {
        billingDocumentId: doc.id,
        description: milestone.title,
        qty: 1,
        unit: '式',
        unitPrice: milestone.plannedAmount,
      })
      const refreshed = await this.listBillingDocuments(quote.id)
      return refreshed.find((d) => d.id === doc.id) ?? doc
    }
    return doc
  },

  async addBillingDocumentItem(
    actor: AppUser,
    input: {
      billingDocumentId: string
      description: string
      qty: number
      unit?: string
      unitPrice: number
    },
  ): Promise<BillingDocumentItem> {
    assertCanManageBilling(actor.role)
    const did = requireUuid(input.billingDocumentId, '請款單')
    const { data: docRow, error: loadError } = await sb()
      .from('billing_documents')
      .select(BILLING_DOC_SELECT)
      .eq('id', did)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取請款單'))
    if (!docRow) throw new AppError('找不到請款單')
    const doc = mapBillingDocumentRow(docRow as Record<string, unknown>)
    assertSameOrganization(actor.organizationId, doc.organizationId)
    assertBillingDocumentEditable({ status: doc.status })
    const existing = await this.listBillingDocumentItems(doc.id)
    const amount = calcQuoteItemAmount({
      qty: input.qty,
      unitPrice: input.unitPrice,
    })
    const { data, error } = await sb()
      .from('billing_document_items')
      .insert({
        billing_document_id: doc.id,
        line_no: existing.length + 1,
        description: input.description.trim(),
        qty: input.qty,
        unit: input.unit || '式',
        unit_price: input.unitPrice,
        amount,
      })
      .select(
        'id, organization_id, billing_document_id, line_no, description, qty, unit, unit_price, amount, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增請款細項'))
    const mapped = mapBillingDocumentItemRow(data as Record<string, unknown>)
    const totals = calcBillingTotals({
      items: [...existing, mapped],
      taxMode: doc.taxMode,
      taxRate: doc.taxRate,
    })
    await sb()
      .from('billing_documents')
      .update({
        amount_before_tax: totals.amountBeforeTax,
        tax_amount: totals.taxAmount,
        amount_after_tax: totals.amountAfterTax,
        tax_rate: totals.taxRate,
      })
      .eq('id', doc.id)
      .eq('status', 'draft')
    return mapped
  },

  async issueBillingDocument(
    actor: AppUser,
    documentId: string,
  ): Promise<BillingDocument> {
    assertCanManageBilling(actor.role)
    const did = requireUuid(documentId, '請款單')
    const { data: docRow, error: loadError } = await sb()
      .from('billing_documents')
      .select(BILLING_DOC_SELECT)
      .eq('id', did)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取請款單'))
    if (!docRow) throw new AppError('找不到請款單')
    const doc = mapBillingDocumentRow(docRow as Record<string, unknown>)
    assertSameOrganization(actor.organizationId, doc.organizationId)
    assertBillingDocumentEditable({ status: doc.status })
    const items = await this.listBillingDocumentItems(doc.id)
    if (items.length === 0) throw new AppError('請先新增請款細項再開立')
    const quote = await this.getQuotation(doc.quotationId)
    const changeOrders = await this.listChangeOrders(quote.id)
    const contract = effectiveContractAmountWithChangeOrders({
      quotes: [quote],
      changeOrders,
    })
    const allDocs = await this.listBillingDocuments(quote.id)
    const alreadyIssued = sumIssuedBillingAmount(allDocs)
    assertIssueDoesNotExceedContract({
      contract,
      alreadyIssued,
      issuingAmount: doc.amountAfterTax,
    })
    if (
      allDocs.some(
        (d) =>
          d.milestoneId === doc.milestoneId &&
          d.status === 'issued' &&
          d.id !== doc.id,
      )
    ) {
      throw new AppError('此請款節點已有正式請款單，不得重複開立')
    }
    const milestones = await this.listBillingMilestones(quote.id)
    const milestone = milestones.find((m) => m.id === doc.milestoneId)
    if (!milestone) throw new AppError('找不到請款節點')
    const now = new Date().toISOString()
    const snapshot = buildBillingSnapshot({
      document: doc,
      milestone,
      quote,
      items,
      issuedAt: now,
    })
    const { data, error } = await sb()
      .from('billing_documents')
      .update({
        status: 'issued',
        snapshot,
        issued_at: now,
        issued_by: actor.id,
      })
      .eq('id', doc.id)
      .eq('status', 'draft')
      .select(BILLING_DOC_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '開立請款單失敗'))
    await sb()
      .from('billing_milestones')
      .update({ status: 'billed' })
      .eq('id', milestone.id)
    return mapBillingDocumentRow(data as Record<string, unknown>)
  },

  async listCustomerPayments(quotationId: string): Promise<CustomerPayment[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('customer_payments')
      .select(
        'id, organization_id, quotation_id, payment_number, amount, method, status, received_at, notes, created_at, created_by',
      )
      .eq('quotation_id', qid)
      .order('received_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入收款'))
    return (data ?? []).map((row) => mapCustomerPaymentRow(row as Record<string, unknown>))
  },

  async listPaymentAllocations(filters: {
    paymentId?: string
    billingDocumentId?: string
    quotationId?: string
  }): Promise<PaymentAllocation[]> {
    let q = sb()
      .from('payment_allocations')
      .select(
        'id, organization_id, payment_id, billing_document_id, amount, created_at, created_by',
      )
    if (filters.paymentId) q = q.eq('payment_id', requireUuid(filters.paymentId, '收款'))
    if (filters.billingDocumentId) {
      q = q.eq(
        'billing_document_id',
        requireUuid(filters.billingDocumentId, '請款單'),
      )
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入收款分配'))
    let rows = (data ?? []).map((row) =>
      mapPaymentAllocationRow(row as Record<string, unknown>),
    )
    if (filters.quotationId) {
      const pays = await this.listCustomerPayments(filters.quotationId)
      const ids = new Set(pays.map((p) => p.id))
      rows = rows.filter((a) => ids.has(a.paymentId))
    }
    return rows
  },

  async listCustomerAdvances(quotationId: string): Promise<CustomerAdvance[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('customer_advances')
      .select(
        'id, organization_id, quotation_id, advance_number, amount, remaining_amount, status, received_at, notes, created_at, created_by',
      )
      .eq('quotation_id', qid)
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入預收款'))
    return (data ?? []).map((row) => mapCustomerAdvanceRow(row as Record<string, unknown>))
  },

  async listAdvanceApplications(filters: {
    advanceId?: string
    billingDocumentId?: string
    quotationId?: string
  }): Promise<AdvanceApplication[]> {
    let q = sb()
      .from('advance_applications')
      .select(
        'id, organization_id, advance_id, billing_document_id, amount, created_at, created_by',
      )
    if (filters.advanceId) q = q.eq('advance_id', requireUuid(filters.advanceId, '預收'))
    if (filters.billingDocumentId) {
      q = q.eq(
        'billing_document_id',
        requireUuid(filters.billingDocumentId, '請款單'),
      )
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入預收抵充'))
    let rows = (data ?? []).map((row) =>
      mapAdvanceApplicationRow(row as Record<string, unknown>),
    )
    if (filters.quotationId) {
      const adv = await this.listCustomerAdvances(filters.quotationId)
      const ids = new Set(adv.map((a) => a.id))
      rows = rows.filter((a) => ids.has(a.advanceId))
    }
    return rows
  },

  async createCustomerPayment(
    actor: AppUser,
    input: {
      quotationId: string
      amount: number
      method: PaymentMethod
      notes?: string
    },
  ): Promise<CustomerPayment> {
    assertCanManagePayments(actor.role)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canRecordPaymentForQuote(quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const amount = Number(input.amount) || 0
    if (amount <= 0) throw new AppError('收款金額必須大於 0')
    const paymentNumber = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('customer_payments')
      .insert({
        quotation_id: quote.id,
        payment_number: paymentNumber,
        amount,
        method: input.method,
        status: 'confirmed',
        notes: input.notes ?? null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, quotation_id, payment_number, amount, method, status, received_at, notes, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登錄收款'))
    return mapCustomerPaymentRow(data as Record<string, unknown>)
  },

  async allocatePayment(
    actor: AppUser,
    input: {
      paymentId: string
      billingDocumentId: string
      amount: number
    },
  ): Promise<PaymentAllocation> {
    assertCanManagePayments(actor.role)
    const pid = requireUuid(input.paymentId, '收款')
    const { data: payRow, error: payErr } = await sb()
      .from('customer_payments')
      .select(
        'id, organization_id, quotation_id, payment_number, amount, method, status, received_at, notes, created_at, created_by',
      )
      .eq('id', pid)
      .maybeSingle()
    if (payErr) throw new AppError(toUserMessage(payErr, '無法讀取收款'))
    if (!payRow) throw new AppError('找不到收款')
    const payment = mapCustomerPaymentRow(payRow as Record<string, unknown>)
    assertSameOrganization(actor.organizationId, payment.organizationId)
    if (payment.status !== 'confirmed') throw new AppError('找不到已確認收款')
    const docs = await this.listBillingDocuments(payment.quotationId)
    const doc = docs.find((d) => d.id === input.billingDocumentId)
    if (!doc || doc.status !== 'issued') {
      throw new AppError('只能分配到已開立的請款單')
    }
    const onPayment = await this.listPaymentAllocations({ paymentId: payment.id })
    const onBilling = await this.listPaymentAllocations({
      billingDocumentId: doc.id,
    })
    const onBillingAdv = await this.listAdvanceApplications({
      billingDocumentId: doc.id,
    })
    assertAllocationFits({
      paymentAmount: payment.amount,
      alreadyAllocatedOnPayment: sumAllocations(onPayment),
      allocating: input.amount,
      billingOpenAmount: billingDocumentOpenAmount({
        document: doc,
        allocations: onBilling,
        advanceApplications: onBillingAdv,
      }),
    })
    const { data, error } = await sb()
      .from('payment_allocations')
      .insert({
        payment_id: payment.id,
        billing_document_id: doc.id,
        amount: Number(input.amount),
        created_by: actor.id,
      })
      .select(
        'id, organization_id, payment_id, billing_document_id, amount, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '收款分配失敗'))
    return mapPaymentAllocationRow(data as Record<string, unknown>)
  },

  async createCustomerAdvance(
    actor: AppUser,
    input: { quotationId: string; amount: number; notes?: string },
  ): Promise<CustomerAdvance> {
    assertCanManagePayments(actor.role)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canRecordPaymentForQuote(quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const amount = Number(input.amount) || 0
    if (amount <= 0) throw new AppError('預收金額必須大於 0')
    const advanceNumber = `ADV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('customer_advances')
      .insert({
        quotation_id: quote.id,
        advance_number: advanceNumber,
        amount,
        remaining_amount: amount,
        status: 'open',
        notes: input.notes ?? null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, quotation_id, advance_number, amount, remaining_amount, status, received_at, notes, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登錄預收款'))
    return mapCustomerAdvanceRow(data as Record<string, unknown>)
  },

  async applyCustomerAdvance(
    actor: AppUser,
    input: {
      advanceId: string
      billingDocumentId: string
      amount: number
    },
  ): Promise<AdvanceApplication> {
    assertCanManagePayments(actor.role)
    const aid = requireUuid(input.advanceId, '預收')
    const { data: advRow, error: advErr } = await sb()
      .from('customer_advances')
      .select(
        'id, organization_id, quotation_id, advance_number, amount, remaining_amount, status, received_at, notes, created_at, created_by',
      )
      .eq('id', aid)
      .maybeSingle()
    if (advErr) throw new AppError(toUserMessage(advErr, '無法讀取預收'))
    if (!advRow) throw new AppError('找不到預收款')
    const advance = mapCustomerAdvanceRow(advRow as Record<string, unknown>)
    assertSameOrganization(actor.organizationId, advance.organizationId)
    if (advance.status !== 'open') throw new AppError('預收款已關閉或作廢')
    const docs = await this.listBillingDocuments(advance.quotationId)
    const doc = docs.find((d) => d.id === input.billingDocumentId)
    if (!doc || doc.status !== 'issued') {
      throw new AppError('只能抵充已開立的請款單')
    }
    const onBilling = await this.listPaymentAllocations({
      billingDocumentId: doc.id,
    })
    const onBillingAdv = await this.listAdvanceApplications({
      billingDocumentId: doc.id,
    })
    assertAdvanceApplicationFits({
      advanceRemaining: advance.remainingAmount,
      applying: input.amount,
      billingOpenAmount: billingDocumentOpenAmount({
        document: doc,
        allocations: onBilling,
        advanceApplications: onBillingAdv,
      }),
    })
    const amt = Number(input.amount)
    const { data, error } = await sb()
      .from('advance_applications')
      .insert({
        advance_id: advance.id,
        billing_document_id: doc.id,
        amount: amt,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, advance_id, billing_document_id, amount, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '預收抵充失敗'))
    const remaining = Math.round((advance.remainingAmount - amt) * 100) / 100
    await sb()
      .from('customer_advances')
      .update({
        remaining_amount: remaining,
        status: remaining <= 0.009 ? 'closed' : 'open',
      })
      .eq('id', advance.id)
    return mapAdvanceApplicationRow(data as Record<string, unknown>)
  },

  async listCustomerCreditNotes(
    quotationId: string,
  ): Promise<CustomerCreditNote[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('customer_credit_notes')
      .select(
        'id, organization_id, quotation_id, billing_document_id, credit_number, amount, reason, status, issued_at, created_at, created_by',
      )
      .eq('quotation_id', qid)
      .order('issued_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入折讓'))
    return (data ?? []).map((row) =>
      mapCustomerCreditNoteRow(row as Record<string, unknown>),
    )
  },

  async listCustomerRefunds(quotationId: string): Promise<CustomerRefund[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('customer_refunds')
      .select(
        'id, organization_id, quotation_id, payment_id, refund_number, amount, method, status, reason, refunded_at, created_at, created_by',
      )
      .eq('quotation_id', qid)
      .order('refunded_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入退款'))
    return (data ?? []).map((row) =>
      mapCustomerRefundRow(row as Record<string, unknown>),
    )
  },

  async createCustomerCreditNote(
    actor: AppUser,
    input: {
      quotationId: string
      amount: number
      reason: string
      billingDocumentId?: string | null
    },
  ): Promise<CustomerCreditNote> {
    assertCanManageRefunds(actor.role)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canIssueCreditOrRefund(quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const docs = await this.listBillingDocuments(quote.id)
    const notes = await this.listCustomerCreditNotes(quote.id)
    assertCreditNoteFits({
      billed: sumIssuedBillingAmount(docs),
      alreadyCredited: sumIssuedCredits(notes),
      crediting: input.amount,
    })
    if (input.billingDocumentId) {
      const doc = docs.find((d) => d.id === input.billingDocumentId)
      if (!doc || doc.status !== 'issued') {
        throw new AppError('折讓僅能關聯已開立請款單')
      }
    }
    const creditNumber = `CN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('customer_credit_notes')
      .insert({
        quotation_id: quote.id,
        billing_document_id: input.billingDocumentId || null,
        credit_number: creditNumber,
        amount: Number(input.amount),
        reason: input.reason.trim() || '折讓',
        status: 'issued',
        created_by: actor.id,
      })
      .select(
        'id, organization_id, quotation_id, billing_document_id, credit_number, amount, reason, status, issued_at, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法開立折讓'))
    return mapCustomerCreditNoteRow(data as Record<string, unknown>)
  },

  async createCustomerRefund(
    actor: AppUser,
    input: {
      quotationId: string
      paymentId: string
      amount: number
      method: PaymentMethod
      reason: string
    },
  ): Promise<CustomerRefund> {
    assertCanManageRefunds(actor.role)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    const gate = canIssueCreditOrRefund(quote)
    if (!gate.ok) throw new AppError(gate.reason)
    const payments = await this.listCustomerPayments(quote.id)
    const payment = payments.find((p) => p.id === input.paymentId)
    if (!payment || payment.status !== 'confirmed') {
      throw new AppError('退款必須對應已確認的原收款（原收款保留）')
    }
    const prior = await this.listCustomerRefunds(quote.id)
    assertRefundFits({
      paymentAmount: payment.amount,
      alreadyRefundedOnPayment: refundsOnPayment(payment.id, prior),
      refunding: input.amount,
    })
    const refundNumber = `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('customer_refunds')
      .insert({
        quotation_id: quote.id,
        payment_id: payment.id,
        refund_number: refundNumber,
        amount: Number(input.amount),
        method: input.method,
        status: 'confirmed',
        reason: input.reason.trim() || '退款',
        created_by: actor.id,
      })
      .select(
        'id, organization_id, quotation_id, payment_id, refund_number, amount, method, status, reason, refunded_at, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登錄退款'))
    return mapCustomerRefundRow(data as Record<string, unknown>)
  },

  async listCaseOperatingCosts(
    quotationId: string,
  ): Promise<CaseOperatingCost[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('case_operating_costs')
      .select(
        'id, organization_id, quotation_id, kind, description, amount, status, warranty_free, confirmed_at, created_at, created_by',
      )
      .eq('quotation_id', qid)
      .order('confirmed_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入營運成本'))
    return (data ?? []).map((row) =>
      mapCaseOperatingCostRow(row as Record<string, unknown>),
    )
  },

  async createCaseOperatingCost(
    actor: AppUser,
    input: {
      quotationId: string
      kind: OperatingCostKind
      description: string
      amount: number
      warrantyFree?: boolean
    },
  ): Promise<CaseOperatingCost> {
    assertCanRecordOperatingCost(
      actor.role,
      Boolean(actor.financeAuthorized),
    )
    assertOperatingCostAmount(input.amount)
    const quote = await this.getQuotation(input.quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    if (quote.deletedAt) throw new AppError('報價案件已刪除')
    const { data, error } = await sb()
      .from('case_operating_costs')
      .insert({
        quotation_id: quote.id,
        kind: input.kind,
        description: input.description.trim() || '已確認營運成本',
        amount: Number(input.amount),
        status: 'confirmed',
        warranty_free: Boolean(input.warrantyFree),
        created_by: actor.id,
      })
      .select(
        'id, organization_id, quotation_id, kind, description, amount, status, warranty_free, confirmed_at, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登錄營運成本'))
    return mapCaseOperatingCostRow(data as Record<string, unknown>)
  },

  async listCustomers(): Promise<Customer[]> {
    const { data, error } = await sb()
      .from('customers')
      .select(
        'id, organization_id, name, phone, notes, created_at, updated_at, created_by',
      )
      .order('name', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入客戶'))
    return (data ?? []).map((row) =>
      mapCustomerRow(row as Record<string, unknown>),
    )
  },

  async createCustomer(
    actor: AppUser,
    input: { name: string; phone?: string | null; notes?: string | null },
  ): Promise<Customer> {
    const name = assertCustomerName(input.name)
    const { data, error } = await sb()
      .from('customers')
      .insert({
        name,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, name, phone, notes, created_at, updated_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立客戶'))
    return mapCustomerRow(data as Record<string, unknown>)
  },

  async listCustomerContacts(customerId: string): Promise<CustomerContact[]> {
    const cid = requireUuid(customerId, '客戶')
    const { data, error } = await sb()
      .from('customer_contacts')
      .select(
        'id, organization_id, customer_id, name, phone, email, is_primary, notes, created_at',
      )
      .eq('customer_id', cid)
      .order('is_primary', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入聯絡人'))
    return (data ?? []).map((row) =>
      mapCustomerContactRow(row as Record<string, unknown>),
    )
  },

  async addCustomerContact(
    actor: AppUser,
    input: {
      customerId: string
      name: string
      phone?: string | null
      email?: string | null
      isPrimary?: boolean
      notes?: string | null
    },
  ): Promise<CustomerContact> {
    const cid = requireUuid(input.customerId, '客戶')
    const name = assertContactName(input.name)
    if (input.isPrimary) {
      await sb()
        .from('customer_contacts')
        .update({ is_primary: false })
        .eq('customer_id', cid)
    }
    const { data, error } = await sb()
      .from('customer_contacts')
      .insert({
        customer_id: cid,
        name,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        is_primary: Boolean(input.isPrimary),
        notes: input.notes?.trim() || null,
      })
      .select(
        'id, organization_id, customer_id, name, phone, email, is_primary, notes, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增聯絡人'))
    void actor
    return mapCustomerContactRow(data as Record<string, unknown>)
  },

  async listCustomerSiteLinks(
    customerId?: string,
  ): Promise<CustomerSiteLink[]> {
    let q = sb()
      .from('customer_site_links')
      .select('id, organization_id, customer_id, site_id, created_at')
    if (customerId) {
      q = q.eq('customer_id', requireUuid(customerId, '客戶'))
    }
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入客戶地址關聯'))
    return (data ?? []).map((row) =>
      mapCustomerSiteLinkRow(row as Record<string, unknown>),
    )
  },

  async linkCustomerToSite(
    actor: AppUser,
    input: { customerId: string; siteId: string },
  ): Promise<CustomerSiteLink> {
    const cid = requireUuid(input.customerId, '客戶')
    const sid = requireUuid(input.siteId, '工地')
    const existing = await this.listCustomerSiteLinks()
    assertCanLinkCustomerToSite({
      customerId: cid,
      siteId: sid,
      existingLinks: existing,
    })
    const { data, error } = await sb()
      .from('customer_site_links')
      .insert({
        customer_id: cid,
        site_id: sid,
      })
      .select('id, organization_id, customer_id, site_id, created_at')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法關聯客戶與地址'))
    void actor
    return mapCustomerSiteLinkRow(data as Record<string, unknown>)
  },

  async listQuotationItems(quotationId: string): Promise<QuotationItem[]> {
    const qid = requireUuid(quotationId, '報價')
    const { data, error } = await sb()
      .from('quotation_items')
      .select(
        'id, organization_id, quotation_id, line_no, kind, description, qty, unit, unit_price, amount, created_at, updated_at',
      )
      .eq('quotation_id', qid)
      .order('line_no', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入報價細項'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      quotationId: String(row.quotation_id),
      lineNo: Number(row.line_no),
      kind: row.kind as QuotationItemKind,
      description: String(row.description),
      qty: Number(row.qty),
      unit: String(row.unit),
      unitPrice: Number(row.unit_price),
      amount: Number(row.amount),
      createdAt: String(row.created_at),
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    }))
  },

  async addQuotationItem(
    actor: AppUser,
    input: {
      quotationId: string
      kind: QuotationItemKind
      description: string
      qty: number
      unit?: string
      unitPrice: number
    },
  ): Promise<QuotationItem> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const qid = requireUuid(input.quotationId, '報價')
    const quote = await this.getQuotation(qid)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })

    const description = input.description.trim()
    if (!description) throw new AppError('請填寫細項說明')
    const amount = calcQuoteItemAmount({
      qty: input.qty,
      unitPrice: input.unitPrice,
    })

    const { data: existing, error: lineError } = await sb()
      .from('quotation_items')
      .select('line_no')
      .eq('quotation_id', qid)
      .order('line_no', { ascending: false })
      .limit(1)
    if (lineError) throw new AppError(toUserMessage(lineError, '無法讀取細項'))
    const lineNo = Number(existing?.[0]?.line_no ?? 0) + 1

    const { data, error } = await sb()
      .from('quotation_items')
      .insert({
        quotation_id: qid,
        line_no: lineNo,
        kind: input.kind,
        description,
        qty: input.qty,
        unit: (input.unit || '式').trim() || '式',
        unit_price: input.unitPrice,
        amount,
      })
      .select(
        'id, organization_id, quotation_id, line_no, kind, description, qty, unit, unit_price, amount, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增報價細項'))
    if (
      quote.workflowStatus === 'exported' ||
      quote.workflowStatus === 'sent_to_customer'
    ) {
      await sb()
        .from('quotations')
        .update({
          workflow_status: 'editing',
          status: 'draft',
        })
        .eq('id', qid)
    }
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      quotationId: String(data.quotation_id),
      lineNo: Number(data.line_no),
      kind: data.kind as QuotationItemKind,
      description: String(data.description),
      qty: Number(data.qty),
      unit: String(data.unit),
      unitPrice: Number(data.unit_price),
      amount: Number(data.amount),
      createdAt: String(data.created_at),
      updatedAt: data.updated_at ? String(data.updated_at) : undefined,
    }
  },

  async updateQuotationItem(
    actor: AppUser,
    itemId: string,
    patch: Partial<{
      kind: QuotationItemKind
      description: string
      qty: number
      unit: string
      unitPrice: number
    }>,
  ): Promise<QuotationItem> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const iid = requireUuid(itemId, '報價細項')
    const { data: item, error: loadError } = await sb()
      .from('quotation_items')
      .select(
        'id, organization_id, quotation_id, kind, description, qty, unit, unit_price',
      )
      .eq('id', iid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取細項'))
    if (!item) throw new AppError('找不到細項')
    assertSameOrganization(actor.organizationId, String(item.organization_id))
    const quote = await this.getQuotation(String(item.quotation_id))
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })
    const qty = patch.qty ?? Number(item.qty)
    const unitPrice = patch.unitPrice ?? Number(item.unit_price)
    const amount = calcQuoteItemAmount({ qty, unitPrice })
    const { data, error } = await sb()
      .from('quotation_items')
      .update({
        kind: patch.kind ?? item.kind,
        description: (patch.description ?? String(item.description)).trim(),
        qty,
        unit: patch.unit ?? String(item.unit),
        unit_price: unitPrice,
        amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', iid)
      .select(
        'id, organization_id, quotation_id, line_no, kind, description, qty, unit, unit_price, amount, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新細項'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      quotationId: String(data.quotation_id),
      lineNo: Number(data.line_no),
      kind: data.kind as QuotationItemKind,
      description: String(data.description),
      qty: Number(data.qty),
      unit: String(data.unit),
      unitPrice: Number(data.unit_price),
      amount: Number(data.amount),
      createdAt: String(data.created_at),
      updatedAt: data.updated_at ? String(data.updated_at) : undefined,
    }
  },

  async removeQuotationItem(actor: AppUser, itemId: string): Promise<void> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const iid = requireUuid(itemId, '報價細項')
    const { data: item, error: loadError } = await sb()
      .from('quotation_items')
      .select('id, organization_id, quotation_id')
      .eq('id', iid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取細項'))
    if (!item) throw new AppError('找不到細項')
    assertSameOrganization(actor.organizationId, String(item.organization_id))
    const quote = await this.getQuotation(String(item.quotation_id))
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })
    const { error } = await sb().from('quotation_items').delete().eq('id', iid)
    if (error) throw new AppError(toUserMessage(error, '無法刪除報價細項'))
  },

  async reorderQuotationItems(
    actor: AppUser,
    quotationId: string,
    orderedIds: string[],
  ): Promise<void> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const quote = await this.getQuotation(quotationId)
    assertSameOrganization(actor.organizationId, quote.organizationId)
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await sb()
        .from('quotation_items')
        .update({ line_no: i + 1, updated_at: new Date().toISOString() })
        .eq('id', orderedIds[i])
        .eq('quotation_id', quotationId)
      if (error) throw new AppError(toUserMessage(error, '無法排序細項'))
    }
  },

  async bindLineUserId(lineUserId: string | null): Promise<AppUser> {
    const trimmed = lineUserId?.trim() || null
    const { data: authData, error: authError } = await sb().auth.getUser()
    if (authError) throw new AppError(toUserMessage(authError, '無法讀取登入狀態'))
    if (!authData.user) throw new AppError('尚未登入')

    const { data, error } = await sb()
      .from('profiles')
      .update({ line_user_id: trimmed })
      .eq('id', authData.user.id)
      .select(
        'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法更新 LINE 綁定'))
    return mapUser(data)
  },

  async createLineBindCode(): Promise<{ code: string; expiresAt: string }> {
    const { data, error } = await sb().rpc('create_line_bind_code')
    if (error) throw new AppError(toUserMessage(error, '無法產生 LINE 綁定碼'))
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.code) throw new AppError('無法產生 LINE 綁定碼')
    return {
      code: String(row.code),
      expiresAt: String(row.expires_at),
    }
  },

  async listMaterials(actor?: AppUser): Promise<MaterialStock[]> {
    if (actor) {
      assertPermission(actor.role, PERMISSIONS.INVENTORY_READ, {
        financeAuthorized: actor.financeAuthorized,
      })
    }
    const { data, error } = await sb()
      .from('materials')
      .select(
        'id, organization_id, name, unit, qty, unit_cost, sku, tracking_mode, base_unit_code, updated_at',
      )
      .order('name', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入庫存'))
    const { data: reservations } = await sb()
      .from('stock_reservations')
      .select('material_id, qty, status')
      .eq('status', 'active')
    const reservedByMaterial = new Map<string, number>()
    for (const r of reservations ?? []) {
      const mid = String(r.material_id)
      reservedByMaterial.set(
        mid,
        roundMoney((reservedByMaterial.get(mid) || 0) + Number(r.qty), 4),
      )
    }
    return (data ?? []).map((row) => {
      const qty = Number(row.qty)
      const reservedQty = reservedByMaterial.get(String(row.id)) || 0
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        name: String(row.name),
        unit: String(row.unit),
        qty,
        unitCost: Number(row.unit_cost),
        sku: row.sku ? String(row.sku) : undefined,
        trackingMode: (row.tracking_mode as MaterialStock['trackingMode']) || 'quantity',
        baseUnitCode: row.base_unit_code
          ? String(row.base_unit_code)
          : String(row.unit),
        reservedQty,
        availableQty: roundMoney(qty - reservedQty, 4),
        updatedAt: String(row.updated_at),
      }
    })
  },

  async listMaterialUnits(materialId?: string): Promise<MaterialUnit[]> {
    let q = sb()
      .from('material_units')
      .select(
        'id, organization_id, material_id, code, label, factor_to_base, is_base',
      )
    if (materialId) q = q.eq('material_id', requireUuid(materialId, '材料'))
    const { data, error } = await q.order('is_base', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入單位'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      materialId: String(row.material_id),
      code: String(row.code),
      label: String(row.label),
      factorToBase: Number(row.factor_to_base),
      isBase: Boolean(row.is_base),
    }))
  },

  async listMaterialSerials(materialId?: string): Promise<MaterialSerial[]> {
    let q = sb()
      .from('material_serials')
      .select(
        'id, organization_id, material_id, serial_number, status, unit_cost, location_id, created_at, created_by',
      )
    if (materialId) q = q.eq('material_id', requireUuid(materialId, '材料'))
    const { data, error } = await q.order('serial_number', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入序號'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      materialId: String(row.material_id),
      serialNumber: String(row.serial_number),
      status: row.status as MaterialSerial['status'],
      unitCost: Number(row.unit_cost),
      locationId: (row.location_id as string | null) ?? null,
      createdAt: String(row.created_at),
      createdBy: String(row.created_by ?? ''),
    }))
  },

  async addMaterialUnit(
    actor: AppUser,
    input: {
      materialId: string
      code: string
      label: string
      factorToBase: number
    },
  ): Promise<MaterialUnit> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_ADJUST, {
      financeAuthorized: actor.financeAuthorized,
    })
    const materialId = requireUuid(input.materialId, '材料')
    const code = input.code.trim()
    if (!code) throw new AppError('單位代碼必填')
    const factor = assertUnitFactor(input.factorToBase)
    const { data, error } = await sb()
      .from('material_units')
      .insert({
        material_id: materialId,
        code,
        label: input.label.trim() || code,
        factor_to_base: factor,
        is_base: false,
      })
      .select(
        'id, organization_id, material_id, code, label, factor_to_base, is_base',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增單位'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      materialId: String(data.material_id),
      code: String(data.code),
      label: String(data.label),
      factorToBase: Number(data.factor_to_base),
      isBase: Boolean(data.is_base),
    }
  },

  async registerMaterialSerial(
    actor: AppUser,
    input: {
      materialId: string
      serialNumber: string
      unitCost: number
      locationId?: string | null
    },
  ): Promise<MaterialSerial> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_INBOUND, {
      financeAuthorized: actor.financeAuthorized,
    })
    const materials = await this.listMaterials(actor)
    const mat = materials.find((m) => m.id === input.materialId)
    if (!mat) throw new AppError('找不到材料')
    if ((mat.trackingMode || 'quantity') !== 'serial') {
      throw new AppError('僅序號追蹤材料可登錄序號')
    }
    const existing = await this.listMaterialSerials()
    const serial = assertSerialUniqueInOrg({
      serial: input.serialNumber,
      existingSerials: existing.map((s) => s.serialNumber),
    })
    const locationId =
      input.locationId || (await this.ensureDefaultWarehouse(actor))
    const unitCost = roundMoney(Number(input.unitCost) || 0, 4)
    const { data, error } = await sb()
      .from('material_serials')
      .insert({
        material_id: requireUuid(mat.id, '材料'),
        serial_number: serial,
        status: 'in_stock',
        unit_cost: unitCost,
        location_id: requireUuid(locationId, '庫位'),
        created_by: actor.id,
      })
      .select(
        'id, organization_id, material_id, serial_number, status, unit_cost, location_id, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登錄序號'))
    await this.upsertStockBalanceDelta({
      materialId: mat.id,
      locationId,
      delta: 1,
    })
    const { error: updError } = await sb()
      .from('materials')
      .update({
        qty: roundMoney(mat.qty + 1, 4),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mat.id)
    if (updError) throw new AppError(toUserMessage(updError, '無法更新庫存'))
    await this.appendStockMovement(actor, {
      movementType: 'inbound',
      materialId: mat.id,
      materialName: mat.name,
      qty: 1,
      unitCost,
      toLocationId: locationId,
      note: `序號 ${serial}`,
      clientOperationId: `serial-in-${String(data.id)}`,
    })
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      materialId: String(data.material_id),
      serialNumber: String(data.serial_number),
      status: data.status as MaterialSerial['status'],
      unitCost: Number(data.unit_cost),
      locationId: (data.location_id as string | null) ?? null,
      createdAt: String(data.created_at),
      createdBy: String(data.created_by ?? ''),
    }
  },

  convertMaterialQty(
    units: MaterialUnit[],
    qty: number,
    fromCode: string,
    toCode: string,
  ): number {
    const from = units.find((u) => u.code === fromCode)
    const to = units.find((u) => u.code === toCode)
    if (!from || !to) throw new AppError('找不到單位設定')
    return convertMaterialQty({
      qty,
      fromFactorToBase: from.factorToBase,
      toFactorToBase: to.factorToBase,
    })
  },

  async listStockLocations(): Promise<StockLocation[]> {
    const { data, error } = await sb()
      .from('stock_locations')
      .select('id, organization_id, kind, name, site_id, is_default, created_at')
      .order('name', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入庫位'))
    return (data ?? []).map((row) =>
      mapStockLocationRow(row as Record<string, unknown>),
    )
  },

  async listStockBalances(materialId?: string): Promise<StockBalance[]> {
    let q = sb()
      .from('stock_balances')
      .select('id, organization_id, material_id, location_id, qty, updated_at')
    if (materialId) q = q.eq('material_id', requireUuid(materialId, '材料'))
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入庫位餘額'))
    return (data ?? []).map((row) =>
      mapStockBalanceRow(row as Record<string, unknown>),
    )
  },

  async listStockMovements(materialId?: string): Promise<StockMovement[]> {
    let q = sb()
      .from('stock_movements')
      .select(
        'id, organization_id, movement_type, material_id, material_name, qty, unit_cost, from_location_id, to_location_id, reservation_id, note, client_operation_id, posted_at, created_by, reversal_of',
      )
    if (materialId) q = q.eq('material_id', requireUuid(materialId, '材料'))
    const { data, error } = await q.order('posted_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入流水帳'))
    return (data ?? []).map((row) =>
      mapStockMovementRow(row as Record<string, unknown>),
    )
  },

  async listStockReservations(materialId?: string): Promise<StockReservation[]> {
    let q = sb()
      .from('stock_reservations')
      .select(
        'id, organization_id, material_id, location_id, qty, status, note, client_operation_id, created_at, created_by, released_at',
      )
    if (materialId) q = q.eq('material_id', requireUuid(materialId, '材料'))
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入預留'))
    return (data ?? []).map((row) =>
      mapStockReservationRow(row as Record<string, unknown>),
    )
  },

  async ensureDefaultWarehouse(actor: AppUser): Promise<string> {
    const locs = await this.listStockLocations()
    const existing =
      locs.find((l) => l.isDefault) || locs.find((l) => l.kind === 'warehouse')
    if (existing) return existing.id
    const { data, error } = await sb()
      .from('stock_locations')
      .insert({
        kind: 'warehouse',
        name: '總倉',
        is_default: true,
        site_id: null,
      })
      .select('id')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立預設倉庫'))
    void actor
    return String(data.id)
  },

  async upsertStockBalanceDelta(input: {
    materialId: string
    locationId: string
    delta: number
  }): Promise<void> {
    const materialId = requireUuid(input.materialId, '材料')
    const locationId = requireUuid(input.locationId, '庫位')
    const { data: existing } = await sb()
      .from('stock_balances')
      .select('id, qty')
      .eq('material_id', materialId)
      .eq('location_id', locationId)
      .maybeSingle()
    const nextQty = roundMoney(Number(existing?.qty || 0) + input.delta, 4)
    if (nextQty < -0.0001) throw new AppError('禁止負庫存')
    if (existing) {
      const { error } = await sb()
        .from('stock_balances')
        .update({ qty: Math.max(0, nextQty), updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw new AppError(toUserMessage(error, '無法更新庫位餘額'))
      return
    }
    const { error } = await sb().from('stock_balances').insert({
      material_id: materialId,
      location_id: locationId,
      qty: Math.max(0, nextQty),
    })
    if (error) throw new AppError(toUserMessage(error, '無法建立庫位餘額'))
  },

  async appendStockMovement(
    actor: AppUser,
    input: {
      movementType: StockMovement['movementType']
      materialId: string
      materialName: string
      qty: number
      unitCost: number
      fromLocationId?: string | null
      toLocationId?: string | null
      reservationId?: string | null
      note?: string | null
      clientOperationId: string
    },
  ): Promise<StockMovement> {
    const { data, error } = await sb()
      .from('stock_movements')
      .insert({
        movement_type: input.movementType,
        material_id: requireUuid(input.materialId, '材料'),
        material_name: input.materialName,
        qty: input.qty,
        unit_cost: input.unitCost,
        from_location_id: optionalUuid(input.fromLocationId, '來源庫位'),
        to_location_id: optionalUuid(input.toLocationId, '目的庫位'),
        reservation_id: optionalUuid(input.reservationId, '預留'),
        note: input.note?.trim() || null,
        client_operation_id: input.clientOperationId.trim(),
        created_by: actor.id,
      })
      .select(
        'id, organization_id, movement_type, material_id, material_name, qty, unit_cost, from_location_id, to_location_id, reservation_id, note, client_operation_id, posted_at, created_by, reversal_of',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法寫入流水帳'))
    return mapStockMovementRow(data as Record<string, unknown>)
  },

  async transferStock(
    actor: AppUser,
    input: {
      materialId: string
      qty: number
      fromLocationId: string
      toLocationId: string
      note?: string | null
      clientOperationId: string
    },
  ): Promise<StockMovement> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_ADJUST, {
      financeAuthorized: actor.financeAuthorized,
    })
    const qty = assertPositiveQty(input.qty, '調撥數量')
    if (input.fromLocationId === input.toLocationId) {
      throw new AppError('調撥來源與目的庫位不可相同')
    }
    const materials = await this.listMaterials(actor)
    const mat = materials.find((m) => m.id === input.materialId)
    if (!mat) throw new AppError('找不到材料')
    assertAvailableForConsume({
      onHand: mat.qty,
      reserved: mat.reservedQty || 0,
      qty,
      label: '調撥數量',
    })
    await this.upsertStockBalanceDelta({
      materialId: mat.id,
      locationId: input.fromLocationId,
      delta: -qty,
    })
    await this.upsertStockBalanceDelta({
      materialId: mat.id,
      locationId: input.toLocationId,
      delta: qty,
    })
    assertTransferDoesNotAffectCost({
      beforeUnitCost: mat.unitCost,
      afterUnitCost: mat.unitCost,
      beforeOrgQty: mat.qty,
      afterOrgQty: mat.qty,
    })
    return this.appendStockMovement(actor, {
      movementType: 'transfer',
      materialId: mat.id,
      materialName: mat.name,
      qty,
      unitCost: mat.unitCost,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      note: input.note,
      clientOperationId: input.clientOperationId,
    })
  },

  async reserveStock(
    actor: AppUser,
    input: {
      materialId: string
      qty: number
      locationId?: string | null
      note?: string | null
      clientOperationId: string
    },
  ): Promise<StockReservation> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_ADJUST, {
      financeAuthorized: actor.financeAuthorized,
    })
    const qty = assertPositiveQty(input.qty, '預留數量')
    const materials = await this.listMaterials(actor)
    const mat = materials.find((m) => m.id === input.materialId)
    if (!mat) throw new AppError('找不到材料')
    assertAvailableForConsume({
      onHand: mat.qty,
      reserved: mat.reservedQty || 0,
      qty,
      label: '預留數量',
    })
    const locationId =
      input.locationId || (await this.ensureDefaultWarehouse(actor))
    const { data, error } = await sb()
      .from('stock_reservations')
      .insert({
        material_id: requireUuid(mat.id, '材料'),
        location_id: requireUuid(locationId, '庫位'),
        qty,
        status: 'active',
        note: input.note?.trim() || null,
        client_operation_id: input.clientOperationId.trim(),
        created_by: actor.id,
      })
      .select(
        'id, organization_id, material_id, location_id, qty, status, note, client_operation_id, created_at, created_by, released_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立預留'))
    const row = mapStockReservationRow(data as Record<string, unknown>)
    await this.appendStockMovement(actor, {
      movementType: 'reserve',
      materialId: mat.id,
      materialName: mat.name,
      qty,
      unitCost: mat.unitCost,
      fromLocationId: locationId,
      reservationId: row.id,
      note: row.note,
      clientOperationId: `mv-${input.clientOperationId}`,
    })
    return row
  },

  async releaseReservation(
    actor: AppUser,
    input: { reservationId: string; clientOperationId: string },
  ): Promise<StockReservation> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_ADJUST, {
      financeAuthorized: actor.financeAuthorized,
    })
    const rid = requireUuid(input.reservationId, '預留')
    const { data: current, error: loadError } = await sb()
      .from('stock_reservations')
      .select(
        'id, organization_id, material_id, location_id, qty, status, note, client_operation_id, created_at, created_by, released_at',
      )
      .eq('id', rid)
      .maybeSingle()
    if (loadError || !current) {
      throw new AppError(toUserMessage(loadError, '找不到預留'))
    }
    const mapped = mapStockReservationRow(current as Record<string, unknown>)
    assertReservationRelease({
      status: mapped.status,
      releaseQty: mapped.qty,
      reservedQty: mapped.qty,
    })
    const { data, error } = await sb()
      .from('stock_reservations')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
      })
      .eq('id', rid)
      .select(
        'id, organization_id, material_id, location_id, qty, status, note, client_operation_id, created_at, created_by, released_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法釋放預留'))
    const materials = await this.listMaterials(actor)
    const mat = materials.find((m) => m.id === mapped.materialId)
    await this.appendStockMovement(actor, {
      movementType: 'release',
      materialId: mapped.materialId,
      materialName: mat?.name || mapped.materialId,
      qty: mapped.qty,
      unitCost: mat?.unitCost || 0,
      fromLocationId: mapped.locationId,
      reservationId: mapped.id,
      clientOperationId: input.clientOperationId,
    })
    return mapStockReservationRow(data as Record<string, unknown>)
  },

  async listMaterialUsages(repairCaseId?: string): Promise<MaterialUsage[]> {
    let q = sb()
      .from('material_usages')
      .select(
        'id, organization_id, material_id, material_name, qty, unit_cost, total_cost, repair_case_id, site_id, note, client_operation_id, posted_at, created_by',
      )
    if (repairCaseId) {
      q = q.eq('repair_case_id', requireUuid(repairCaseId, '維修案件'))
    }
    const { data, error } = await q.order('posted_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入耗用'))
    return (data ?? []).map((row) =>
      mapMaterialUsageRow(row as Record<string, unknown>),
    )
  },

  async postMaterialUsage(
    actor: AppUser,
    input: {
      materialId: string
      qty: number
      repairCaseId?: string | null
      siteId?: string | null
      note?: string | null
      clientOperationId: string
    },
  ): Promise<MaterialUsage> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_ADJUST, {
      financeAuthorized: actor.financeAuthorized,
    })
    const qty = assertUsageQty(input.qty)
    const materialId = requireUuid(input.materialId, '材料')
    const existing = await this.listMaterialUsages()
    assertUsageNotAlreadyPosted({
      clientOperationId: input.clientOperationId,
      existingOperationIds: existing.map((u) => u.clientOperationId),
    })
    const { data: material, error: loadError } = await sb()
      .from('materials')
      .select('id, organization_id, name, unit, qty, unit_cost, updated_at')
      .eq('id', materialId)
      .maybeSingle()
    if (loadError || !material) {
      throw new AppError(toUserMessage(loadError, '找不到材料'))
    }
    assertSameOrganization(actor.organizationId, String(material.organization_id))
    const listed = await this.listMaterials(actor)
    const withReserve = listed.find((m) => m.id === materialId)
    const reservedQty = withReserve?.reservedQty || 0
    assertAvailableForConsume({
      onHand: Number(material.qty),
      reserved: reservedQty,
      qty,
      label: '耗用數量',
    })
    assertNoNegativeStock({
      availableQty: Number(material.qty) - reservedQty,
      usageQty: qty,
    })
    const unitCost = Number(material.unit_cost)
    const totalCost = computeUsageCost({ qty, unitCost })
    const nextQty = roundMoney(Number(material.qty) - qty, 4)
    const locationId = await this.ensureDefaultWarehouse(actor)
    await this.upsertStockBalanceDelta({
      materialId,
      locationId,
      delta: -qty,
    })
    const { error: updError } = await sb()
      .from('materials')
      .update({ qty: nextQty, updated_at: new Date().toISOString() })
      .eq('id', materialId)
    if (updError) throw new AppError(toUserMessage(updError, '無法扣減庫存'))
    const { data, error } = await sb()
      .from('material_usages')
      .insert({
        material_id: materialId,
        material_name: String(material.name),
        qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        repair_case_id: optionalUuid(input.repairCaseId, '維修案件'),
        site_id: optionalUuid(input.siteId, '工地'),
        note: input.note?.trim() || null,
        client_operation_id: input.clientOperationId.trim(),
        created_by: actor.id,
      })
      .select(
        'id, organization_id, material_id, material_name, qty, unit_cost, total_cost, repair_case_id, site_id, note, client_operation_id, posted_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法過帳耗用'))
    await this.appendStockMovement(actor, {
      movementType: 'usage',
      materialId,
      materialName: String(material.name),
      qty,
      unitCost,
      fromLocationId: locationId,
      note: input.note,
      clientOperationId: `mv-usage-${input.clientOperationId.trim()}`,
    })
    return mapMaterialUsageRow(data as Record<string, unknown>)
  },

  async createQuoteFromRepairUsages(
    actor: AppUser,
    input: {
      repairCaseId: string
      title?: string
      taxMode?: TaxMode
    },
  ): Promise<Quotation> {
    const rid = requireUuid(input.repairCaseId, '維修案件')
    const cases = await this.listRepairCases()
    const repair = cases.find((c) => c.id === rid)
    if (!repair) throw new AppError('找不到維修案件')
    const usages = await this.listMaterialUsages(rid)
    if (usages.length === 0) throw new AppError('尚無耗用可轉報價')
    const quote = await this.createQuotation(actor, {
      title: input.title || `維修報價 · ${repair.problemDescription}`,
      repairCaseId: rid,
      projectId: null,
      taxMode: input.taxMode || 'zero',
      customerName: repair.customerName || '',
    })
    for (const u of usages) {
      await this.addQuotationItem(actor, {
        quotationId: quote.id,
        kind: 'material',
        description: `${u.materialName}（耗用）`,
        qty: u.qty,
        unitPrice: u.unitCost,
      })
    }
    return this.getQuotation(quote.id)
  },

  async inboundMaterial(
    actor: AppUser,
    input: {
      materialId: string
      qty: number
      unitCost: number
      locationId?: string | null
      clientOperationId?: string
    },
  ): Promise<MaterialStock> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_INBOUND, {
      financeAuthorized: actor.financeAuthorized,
    })
    const materialId = requireUuid(input.materialId, '材料')
    const inboundQty = assertPositiveQty(input.qty, '入庫數量')
    if (input.unitCost < 0) throw new AppError('入庫單價不可為負')

    const { data: current, error: loadError } = await sb()
      .from('materials')
      .select('id, organization_id, name, unit, qty, unit_cost, updated_at')
      .eq('id', materialId)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取材料'))
    if (!current) throw new AppError('找不到材料')
    assertSameOrganization(actor.organizationId, String(current.organization_id))

    const next = applyInboundMovingAverage({
      oldQty: Number(current.qty),
      oldUnitCost: Number(current.unit_cost),
      inboundQty,
      inboundUnitCost: input.unitCost,
    })
    if (next.qty < 0) throw new AppError('禁止負庫存')

    const locationId =
      input.locationId || (await this.ensureDefaultWarehouse(actor))
    await this.upsertStockBalanceDelta({
      materialId,
      locationId,
      delta: inboundQty,
    })

    const { data, error } = await sb()
      .from('materials')
      .update({
        qty: next.qty,
        unit_cost: next.unitCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', materialId)
      .select('id, organization_id, name, unit, qty, unit_cost, updated_at')
      .single()
    if (error) throw new AppError(toUserMessage(error, '入庫失敗'))
    await this.appendStockMovement(actor, {
      movementType: 'inbound',
      materialId,
      materialName: String(current.name),
      qty: inboundQty,
      unitCost: roundMoney(input.unitCost, 4),
      toLocationId: locationId,
      clientOperationId:
        input.clientOperationId?.trim() || `inbound-${crypto.randomUUID()}`,
    })
    const reserved = (await this.listMaterials(actor)).find(
      (m) => m.id === materialId,
    )
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      name: String(data.name),
      unit: String(data.unit),
      qty: Number(data.qty),
      unitCost: Number(data.unit_cost),
      reservedQty: reserved?.reservedQty || 0,
      availableQty: reserved?.availableQty ?? Number(data.qty),
      updatedAt: String(data.updated_at),
    }
  },

  async listNotices(userId: string): Promise<AppNotice[]> {
    const uid = requireUuid(userId, '使用者')
    const { data, error } = await sb()
      .from('notices')
      .select(
        'id, organization_id, user_id, kind, title, detail, status, unread, href, created_at',
      )
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入通知'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      userId: String(row.user_id),
      kind: row.kind as AppNotice['kind'],
      title: String(row.title),
      detail: String(row.detail),
      status: row.status as AppNotice['status'],
      unread: Boolean(row.unread),
      createdAt: String(row.created_at),
      href: (row.href as string | undefined) ?? undefined,
    }))
  },

  async markNoticeRead(id: string): Promise<void> {
    const nid = requireUuid(id, '通知')
    const { error } = await sb()
      .from('notices')
      .update({ unread: false })
      .eq('id', nid)
    if (error) throw new AppError(toUserMessage(error, '無法標記已讀'))
  },

  async completeNotice(id: string): Promise<void> {
    const nid = requireUuid(id, '通知')
    const { error } = await sb()
      .from('notices')
      .update({ unread: false, status: 'done' })
      .eq('id', nid)
    if (error) throw new AppError(toUserMessage(error, '無法完成待辦'))
  },

  /**
   * Today’s team: only members with attendance today.
   * Shows 最後地點 (footprint or site), not full GPS for peers.
   */
  async listTeamPresence(): Promise<TeamPresence[]> {
    const day = taipeiDateString()
    const dayStart = `${day}T00:00:00+08:00`
    const dayEnd = `${day}T23:59:59.999+08:00`

    const { data: shifts, error: attError } = await sb()
      .from('attendance')
      .select('id, user_id, status, clock_in_at, clock_out_at, site_id')
      .gte('clock_in_at', dayStart)
      .lte('clock_in_at', dayEnd)
      .order('clock_in_at', { ascending: false })
    if (attError) throw new AppError(toUserMessage(attError, '無法載入到班狀態'))

    if (!shifts?.length) return []

    const latestByUser = new Map<string, (typeof shifts)[number]>()
    for (const row of shifts) {
      const uid = String(row.user_id)
      if (!latestByUser.has(uid)) latestByUser.set(uid, row)
    }

    const userIds = [...latestByUser.keys()]
    const { data: profiles, error: profileError } = await sb()
      .from('profiles')
      .select('id, name')
      .in('id', userIds)
    if (profileError) throw new AppError(toUserMessage(profileError, '無法載入團隊'))
    const nameById = new Map(
      (profiles ?? []).map((p) => [String(p.id), String(p.name)]),
    )

    const { data: checkins, error: locError } = await sb()
      .from('location_checkins')
      .select(
        'user_id, recorded_at, label, address, site_id, latitude, longitude',
      )
      .in('user_id', userIds)
      .gte('recorded_at', dayStart)
      .lte('recorded_at', dayEnd)
      .order('recorded_at', { ascending: false })
    if (locError) throw new AppError(toUserMessage(locError, '無法載入地點紀錄'))

    const latestLocByUser = new Map<
      string,
      {
        user_id: unknown
        recorded_at: unknown
        label: unknown
        address: unknown
        site_id: unknown
        latitude: unknown
        longitude: unknown
      }
    >()
    for (const row of checkins ?? []) {
      const uid = String(row.user_id)
      if (!latestLocByUser.has(uid)) latestLocByUser.set(uid, row)
    }

    const siteIds = [
      ...new Set(
        [
          ...[...latestByUser.values()].map((s) => s.site_id as string | null),
          ...[...latestLocByUser.values()].map((c) => c.site_id as string | null),
        ].filter((id): id is string => Boolean(id)),
      ),
    ]
    let siteNames = new Map<string, string>()
    if (siteIds.length > 0) {
      const { data: sites, error: siteError } = await sb()
        .from('sites')
        .select('id, name')
        .in('id', siteIds)
      if (siteError) throw new AppError(toUserMessage(siteError, '無法載入工地名稱'))
      siteNames = new Map((sites ?? []).map((s) => [String(s.id), String(s.name)]))
    }

    return userIds
      .map((uid) => {
        const shift = latestByUser.get(uid)!
        const clockedIn = String(shift.status) === 'clocked_in'
        const siteId = shift.site_id as string | null
        const siteName = siteId ? siteNames.get(siteId) ?? null : null
        const loc = latestLocByUser.get(uid)
        let lastLocation: string | null = null
        let lastLocationAt: string | null = null
        if (loc) {
          lastLocationAt = String(loc.recorded_at)
          if (loc.site_id) {
            lastLocation = siteNames.get(String(loc.site_id)) ?? null
          }
          lastLocation =
            lastLocation ||
            (loc.label as string | null) ||
            (loc.address as string | null) ||
            (loc.latitude != null && loc.longitude != null
              ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`
              : null)
        } else if (siteName) {
          lastLocation = siteName
          lastLocationAt = String(shift.clock_in_at)
        }

        return {
          userId: uid,
          name: nameById.get(uid) ?? '未知',
          clockedIn,
          siteName,
          lastLocation,
          lastLocationAt,
          clockInAt: String(shift.clock_in_at),
          clockOutAt: (shift.clock_out_at as string | null) ?? null,
        } satisfies TeamPresence
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  },

  async listLocationCheckins(input: {
    userId: string
    day?: string
    attendanceId?: string | null
  }): Promise<LocationCheckin[]> {
    const uid = requireUuid(input.userId, '使用者')
    let q = sb()
      .from('location_checkins')
      .select(
        'id, organization_id, user_id, recorded_at, source, site_id, label, address, latitude, longitude, note, attendance_id',
      )
      .eq('user_id', uid)
      .order('recorded_at', { ascending: true })
      .limit(200)

    if (input.attendanceId) {
      q = q.eq('attendance_id', requireUuid(input.attendanceId, '出勤'))
    } else if (input.day) {
      const dayStart = `${input.day}T00:00:00+08:00`
      const dayEnd = `${input.day}T23:59:59.999+08:00`
      q = q.gte('recorded_at', dayStart).lte('recorded_at', dayEnd)
    }

    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入地點紀錄'))

    const siteIds = [
      ...new Set(
        (data ?? [])
          .map((r) => r.site_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    let siteNames = new Map<string, string>()
    if (siteIds.length > 0) {
      const { data: sites } = await sb().from('sites').select('id, name').in('id', siteIds)
      siteNames = new Map((sites ?? []).map((s) => [String(s.id), String(s.name)]))
    }

    return (data ?? []).map((row) => mapLocationCheckin(row, siteNames))
  },

  async createLocationCheckin(
    actor: AppUser,
    input: {
      siteId?: string | null
      label?: string | null
      address?: string | null
      latitude?: number | null
      longitude?: number | null
      note?: string | null
      source?: LocationCheckin['source']
    },
  ): Promise<LocationCheckin> {
    const open = await this.getOpenAttendance(actor.id)
    const source = input.source ?? 'manual'
    const { data, error } = await sb()
      .from('location_checkins')
      .insert({
        organization_id: actor.organizationId,
        user_id: actor.id,
        recorded_at: new Date().toISOString(),
        source,
        site_id: input.siteId || null,
        label: input.label?.trim() || null,
        address: input.address?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        note: input.note?.trim() || null,
        attendance_id: open?.id ?? null,
      })
      .select(
        'id, organization_id, user_id, recorded_at, source, site_id, label, address, latitude, longitude, note, attendance_id',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立地點紀錄'))
    return mapLocationCheckin(data, new Map())
  },

  async listPhotoUploads(siteId?: string | null): Promise<PhotoUpload[]> {
    let q = sb()
      .from('photo_uploads')
      .select(
        'id, organization_id, uploaded_by, site_id, photo_type, storage_path, content_type, byte_size, source, status, created_at',
      )
      .neq('status', 'discarded')
      .order('created_at', { ascending: false })
      .limit(200)
    if (siteId) {
      q = q.eq('site_id', requireUuid(siteId, '工地'))
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入施工照片'))

    const rows = data ?? []
    const uploaderIds = [...new Set(rows.map((r) => String(r.uploaded_by)))]
    const siteIds = [
      ...new Set(
        rows
          .map((r) => r.site_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    const nameByUser = new Map<string, string>()
    if (uploaderIds.length > 0) {
      const { data: profiles } = await sb()
        .from('profiles')
        .select('id, name')
        .in('id', uploaderIds)
      for (const p of profiles ?? []) {
        nameByUser.set(String(p.id), String(p.name))
      }
    }

    const nameBySite = new Map<string, string>()
    if (siteIds.length > 0) {
      const { data: sites } = await sb().from('sites').select('id, name').in('id', siteIds)
      for (const s of sites ?? []) {
        nameBySite.set(String(s.id), String(s.name))
      }
    }

    const paths = rows.map((r) => String(r.storage_path))
    const previewByPath = new Map<string, string>()
    if (paths.length > 0) {
      const { data: signed } = await sb()
        .storage.from('site-photos')
        .createSignedUrls(paths, 3600)
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) {
          previewByPath.set(item.path, item.signedUrl)
        }
      }
    }

    return rows.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      uploadedBy: String(row.uploaded_by),
      uploaderName: nameByUser.get(String(row.uploaded_by)),
      siteId: row.site_id ? String(row.site_id) : null,
      siteName: row.site_id ? nameBySite.get(String(row.site_id)) ?? null : null,
      photoType: (row.photo_type as PhotoUpload['photoType']) ?? 'unclassified',
      storagePath: String(row.storage_path),
      contentType: row.content_type ? String(row.content_type) : null,
      byteSize: row.byte_size == null ? null : Number(row.byte_size),
      source: String(row.source),
      status: row.status as PhotoUpload['status'],
      previewUrl: previewByPath.get(String(row.storage_path)) ?? null,
      createdAt: String(row.created_at),
    }))
  },

  async linkPhotoUpload(
    photoId: string,
    siteId: string,
    photoType?: string | null,
  ): Promise<void> {
    const type = assertPhotoType(photoType || 'unclassified')
    const { error } = await sb()
      .from('photo_uploads')
      .update({
        site_id: requireUuid(siteId, '工地'),
        photo_type: type,
        status: 'linked',
      })
      .eq('id', requireUuid(photoId, '照片'))
    if (error) throw new AppError(toUserMessage(error, '無法指定工地'))
  },

  async classifyPhotoUpload(
    photoId: string,
    photoType: string,
  ): Promise<void> {
    const type = assertPhotoType(photoType)
    const { error } = await sb()
      .from('photo_uploads')
      .update({ photo_type: type })
      .eq('id', requireUuid(photoId, '照片'))
    if (error) throw new AppError(toUserMessage(error, '無法更新照片分類'))
  },

  async discardPhotoUpload(photoId: string): Promise<void> {
    const { error } = await sb()
      .from('photo_uploads')
      .update({ status: 'discarded' })
      .eq('id', requireUuid(photoId, '照片'))
    if (error) throw new AppError(toUserMessage(error, '無法捨棄照片'))
  },

  async deletePhotoUploads(photoIds: string[]): Promise<number> {
    const ids = [...new Set(photoIds.map((id) => requireUuid(id, '照片')))]
    if (ids.length === 0) return 0

    const { data: rows, error: loadError } = await sb()
      .from('photo_uploads')
      .select('id, storage_path')
      .in('id', ids)
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取照片'))
    const paths = (rows ?? [])
      .map((r) => String(r.storage_path || ''))
      .filter(Boolean)

    if (paths.length > 0) {
      const { error: storageError } = await sb()
        .storage.from('site-photos')
        .remove(paths)
      if (storageError) {
        throw new AppError(toUserMessage(storageError, '無法刪除照片檔案'))
      }
    }

    const { error } = await sb().from('photo_uploads').delete().in('id', ids)
    if (error) throw new AppError(toUserMessage(error, '無法刪除照片紀錄'))
    return ids.length
  },

  async downloadPhotoBlobs(
    photos: Array<{ id: string; storagePath: string; contentType?: string | null }>,
  ): Promise<Array<{ id: string; blob: Blob; filename: string }>> {
    const out: Array<{ id: string; blob: Blob; filename: string }> = []
    for (const photo of photos) {
      const { data, error } = await sb()
        .storage.from('site-photos')
        .download(photo.storagePath)
      if (error || !data) {
        throw new AppError(toUserMessage(error, '無法下載照片'))
      }
      const ext = photo.storagePath.includes('.')
        ? photo.storagePath.split('.').pop() || 'jpg'
        : 'jpg'
      out.push({
        id: photo.id,
        blob: data,
        filename: `photo-${photo.id.slice(0, 8)}.${ext}`,
      })
    }
    return out
  },

  async uploadAppPhoto(input: {
    file: File
    siteId?: string | null
    photoType?: string | null
  }): Promise<PhotoUpload> {
    const { data: authData, error: authError } = await sb().auth.getUser()
    if (authError) throw new AppError(toUserMessage(authError, '無法讀取登入狀態'))
    if (!authData.user) throw new AppError('尚未登入')

    const me = await this.getCurrentUser()
    if (!me) throw new AppError('找不到個人資料')

    const photoType = assertPhotoType(input.photoType || 'unclassified')
    const siteId = optionalUuid(input.siteId)
    if (!siteId) {
      throw new AppError('請先選擇工地，再上傳照片（工地檔案只顯示該工地）')
    }
    const mime = input.file.type || 'image/jpeg'
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    const path = `${me.organizationId}/${me.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await sb().storage.from('site-photos').upload(path, input.file, {
      contentType: mime,
      upsert: false,
    })
    if (uploadError) {
      throw new AppError(toUserMessage(uploadError, '無法上傳照片'))
    }

    const { data, error } = await sb()
      .from('photo_uploads')
      .insert({
        organization_id: me.organizationId,
        uploaded_by: me.id,
        site_id: siteId,
        photo_type: photoType,
        storage_path: path,
        content_type: mime,
        byte_size: input.file.size,
        source: 'app',
        status: 'linked',
      })
      .select(
        'id, organization_id, uploaded_by, site_id, photo_type, storage_path, content_type, byte_size, source, status, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法寫入照片紀錄'))

    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      uploadedBy: String(data.uploaded_by),
      siteId: data.site_id ? String(data.site_id) : null,
      photoType: (data.photo_type as PhotoUpload['photoType']) ?? photoType,
      storagePath: String(data.storage_path),
      contentType: data.content_type ? String(data.content_type) : null,
      byteSize: data.byte_size == null ? null : Number(data.byte_size),
      source: String(data.source),
      status: data.status as PhotoUpload['status'],
      createdAt: String(data.created_at),
    }
  },

  async listConstructionReports(siteId?: string): Promise<ConstructionReport[]> {
    let query = sb()
      .from('construction_reports')
      .select('id, organization_id, site_id, author_id, body, photo_upload_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (siteId) {
      query = query.eq('site_id', requireUuid(siteId, '工地'))
    }
    const { data, error } = await query
    if (error) throw new AppError(toUserMessage(error, '無法載入施工回報'))

    const rows = data ?? []
    const siteIds = [...new Set(rows.map((r) => String(r.site_id)))]
    const authorIds = [...new Set(rows.map((r) => String(r.author_id)))]
    const photoIds = rows
      .map((r) => r.photo_upload_id as string | null)
      .filter((id): id is string => Boolean(id))

    const siteNames = new Map<string, string>()
    if (siteIds.length > 0) {
      const { data: sites } = await sb().from('sites').select('id, name').in('id', siteIds)
      for (const s of sites ?? []) siteNames.set(String(s.id), String(s.name))
    }

    const authorNames = new Map<string, string>()
    if (authorIds.length > 0) {
      const { data: profiles } = await sb()
        .from('profiles')
        .select('id, name')
        .in('id', authorIds)
      for (const p of profiles ?? []) authorNames.set(String(p.id), String(p.name))
    }

    const photoPathById = new Map<string, string>()
    if (photoIds.length > 0) {
      const { data: photos } = await sb()
        .from('photo_uploads')
        .select('id, storage_path')
        .in('id', photoIds)
      for (const p of photos ?? []) {
        photoPathById.set(String(p.id), String(p.storage_path))
      }
    }

    const previewByPath = new Map<string, string>()
    const paths = [...photoPathById.values()]
    if (paths.length > 0) {
      const { data: signed } = await sb()
        .storage.from('site-photos')
        .createSignedUrls(paths, 3600)
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) previewByPath.set(item.path, item.signedUrl)
      }
    }

    return rows.map((row) => {
      const photoId = row.photo_upload_id ? String(row.photo_upload_id) : null
      const path = photoId ? photoPathById.get(photoId) : null
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        siteId: String(row.site_id),
        siteName: siteNames.get(String(row.site_id)),
        authorId: String(row.author_id),
        authorName: authorNames.get(String(row.author_id)),
        body: String(row.body ?? ''),
        photoUploadId: photoId,
        photoPreviewUrl: path ? previewByPath.get(path) ?? null : null,
        createdAt: String(row.created_at),
      }
    })
  },

  async createConstructionReport(input: {
    siteId: string
    body?: string
    photoUploadId?: string | null
  }): Promise<ConstructionReport> {
    const me = await this.getCurrentUser()
    if (!me) throw new AppError('尚未登入')

    const body = (input.body ?? '').trim()
    const photoUploadId = optionalUuid(input.photoUploadId)
    if (!body && !photoUploadId) {
      throw new AppError('請填寫文字或附上照片')
    }

    const { data, error } = await sb()
      .from('construction_reports')
      .insert({
        organization_id: me.organizationId,
        site_id: requireUuid(input.siteId, '工地'),
        author_id: me.id,
        body,
        photo_upload_id: photoUploadId,
      })
      .select('id, organization_id, site_id, author_id, body, photo_upload_id, created_at')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立施工回報'))

    if (photoUploadId) {
      await sb()
        .from('photo_uploads')
        .update({ site_id: requireUuid(input.siteId, '工地'), status: 'linked' })
        .eq('id', photoUploadId)
        .eq('status', 'pending')
    }

    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: String(data.site_id),
      authorId: String(data.author_id),
      authorName: me.name,
      body: String(data.body ?? ''),
      photoUploadId: data.photo_upload_id ? String(data.photo_upload_id) : null,
      createdAt: String(data.created_at),
    }
  },

  async createManualTodo(input: {
    title: string
    detail?: string
    href?: string | null
  }): Promise<void> {
    const me = await this.getCurrentUser()
    if (!me) throw new AppError('尚未登入')
    const title = input.title.trim()
    if (!title) throw new AppError('請填寫待辦標題')

    const { error } = await sb().rpc('create_org_notices', {
      p_recipient_ids: [me.id],
      p_kind: 'todo',
      p_title: title,
      p_detail: input.detail?.trim() || '',
      p_href: input.href ?? null,
      p_as_todo: true,
    })
    if (error) throw new AppError(toUserMessage(error, '無法新增待辦'))
  },

  async createAssignedTodo(
    actor: AppUser,
    input: {
      title: string
      detail?: string
      href?: string | null
      assigneeUserId: string
    },
  ): Promise<void> {
    const title = input.title.trim()
    if (!title) throw new AppError('請填寫待辦標題')
    const assignee = requireUuid(input.assigneeUserId, '指派對象')
    const { error } = await sb().rpc('create_org_notices', {
      p_recipient_ids: [assignee],
      p_kind: 'todo',
      p_title: title,
      p_detail: input.detail?.trim() || `由 ${actor.name} 指派`,
      p_href: input.href ?? '/todos',
      p_as_todo: true,
    })
    if (error) throw new AppError(toUserMessage(error, '無法指派待辦'))
    await this.appendAuditLog(actor, {
      action: 'todo.assign',
      targetType: 'todo',
      targetId: assignee,
      after: { title, assigneeUserId: assignee },
    })
  },

  async appendAuditLog(
    actor: AppUser,
    input: {
      action: AuditAction | string
      targetType: string
      targetId: string
      before?: unknown
      after?: unknown
      result?: 'ok' | 'error'
      message?: string
    },
  ): Promise<void> {
    await sb().from('audit_logs').insert({
      action: input.action,
      actor_id: actor.id,
      actor_name: actor.name,
      target_type: input.targetType,
      target_id: input.targetId,
      before_json: input.before == null ? null : JSON.stringify(input.before),
      after_json: input.after == null ? null : JSON.stringify(input.after),
      result: input.result || 'ok',
      message: input.message || null,
    })
  },

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    const { data, error } = await sb()
      .from('audit_logs')
      .select(
        'id, organization_id, action, actor_id, actor_name, target_type, target_id, before_json, after_json, result, message, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) throw new AppError(toUserMessage(error, '無法載入操作紀錄'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      action: String(row.action),
      actorId: String(row.actor_id),
      actorName: String(row.actor_name),
      targetType: String(row.target_type),
      targetId: String(row.target_id),
      beforeJson: (row.before_json as string | null) ?? null,
      afterJson: (row.after_json as string | null) ?? null,
      result: row.result as 'ok' | 'error',
      message: (row.message as string | null) ?? null,
      createdAt: String(row.created_at),
    }))
  },

  async getOrgSpendSettings(actor: AppUser): Promise<OrgSpendSettings> {
    const { data, error } = await sb()
      .from('org_spend_settings')
      .select(
        'organization_id, report_review_threshold_ntd, emergency_single_limit_ntd, emergency_daily_limit_ntd, daily_purchase_limit_ntd, updated_at, updated_by',
      )
      .eq('organization_id', actor.organizationId)
      .maybeSingle()
    if (error) {
      throw new AppError(toUserMessage(error, '無法讀取額度設定'))
    }
    if (!data) {
      return defaultOrgSpendSettings(actor.organizationId)
    }
    return {
      organizationId: String(data.organization_id),
      reportReviewThresholdNtd: Number(data.report_review_threshold_ntd),
      emergencySingleLimitNtd: Number(data.emergency_single_limit_ntd),
      emergencyDailyLimitNtd: Number(data.emergency_daily_limit_ntd),
      dailyPurchaseLimitNtd: Number(data.daily_purchase_limit_ntd),
      updatedAt: String(data.updated_at),
      updatedBy: (data.updated_by as string | null) ?? null,
    }
  },

  async updateOrgSpendSettings(
    actor: AppUser,
    input: {
      reportReviewThresholdNtd: number
      emergencySingleLimitNtd: number
      emergencyDailyLimitNtd: number
      dailyPurchaseLimitNtd: number
    },
  ): Promise<OrgSpendSettings> {
    if (actor.role !== 'boss') {
      throw new AppError('僅老闆可設定額度')
    }
    const next = assertSpendSettingsInput(input)
    const payload = {
      organization_id: actor.organizationId,
      report_review_threshold_ntd: next.reportReviewThresholdNtd,
      emergency_single_limit_ntd: next.emergencySingleLimitNtd,
      emergency_daily_limit_ntd: next.emergencyDailyLimitNtd,
      daily_purchase_limit_ntd: next.dailyPurchaseLimitNtd,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    }
    const { data, error } = await sb()
      .from('org_spend_settings')
      .upsert(payload, { onConflict: 'organization_id' })
      .select(
        'organization_id, report_review_threshold_ntd, emergency_single_limit_ntd, emergency_daily_limit_ntd, daily_purchase_limit_ntd, updated_at, updated_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法儲存額度設定'))
    const row: OrgSpendSettings = {
      organizationId: String(data.organization_id),
      reportReviewThresholdNtd: Number(data.report_review_threshold_ntd),
      emergencySingleLimitNtd: Number(data.emergency_single_limit_ntd),
      emergencyDailyLimitNtd: Number(data.emergency_daily_limit_ntd),
      dailyPurchaseLimitNtd: Number(data.daily_purchase_limit_ntd),
      updatedAt: String(data.updated_at),
      updatedBy: (data.updated_by as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action: 'permission.update',
      targetType: 'org_spend_settings',
      targetId: actor.organizationId,
      after: row,
    })
    return row
  },

  async listExpenseReports(actor: AppUser): Promise<ExpenseReport[]> {
    let q = sb()
      .from('expense_reports')
      .select(
        'id, organization_id, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_by, reported_by_name, reported_at, reviewed_by, reviewed_at, review_note',
      )
    if (actor.role !== 'boss') q = q.eq('reported_by', actor.id)
    const { data, error } = await q.order('reported_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入支出'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      siteId: row.site_id ? String(row.site_id) : null,
      siteName: String(row.site_name),
      locationText: (row.location_text as string | null) ?? null,
      item: String(row.item),
      amount: Number(row.amount),
      note: (row.note as string | null) ?? null,
      receiptPhotoPath: (row.receipt_photo_path as string | null) ?? null,
      status: row.status as ExpenseReport['status'],
      reportedBy: String(row.reported_by),
      reportedByName: String(row.reported_by_name),
      reportedAt: String(row.reported_at),
      reviewedBy: (row.reviewed_by as string | null) ?? null,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
      reviewNote: (row.review_note as string | null) ?? null,
    }))
  },

  async uploadReceiptPhoto(input: {
    file: File
    siteId?: string | null
  }): Promise<string> {
    const me = await this.getCurrentUser()
    if (!me) throw new AppError('尚未登入')
    const siteId = input.siteId ? requireUuid(input.siteId, '工地') : null
    const mime = input.file.type || 'image/jpeg'
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    const path = `${me.organizationId}/${me.id}/receipt-${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await sb()
      .storage.from('site-photos')
      .upload(path, input.file, { contentType: mime, upsert: false })
    if (uploadError) {
      throw new AppError(toUserMessage(uploadError, '無法上傳收據照片'))
    }
    await sb().from('photo_uploads').insert({
      organization_id: me.organizationId,
      uploaded_by: me.id,
      site_id: siteId,
      photo_type: 'unclassified',
      storage_path: path,
      content_type: mime,
      byte_size: input.file.size,
      source: 'app-receipt',
      status: siteId ? 'linked' : 'pending',
    })
    return path
  },

  async createExpenseReport(
    actor: AppUser,
    input: {
      siteId?: string | null
      item: string
      amount: number
      note?: string | null
      locationText?: string | null
      receiptPhotoPath?: string | null
      misc?: boolean
    },
  ): Promise<ExpenseReport> {
    let target = resolveFieldCashTarget({
      siteId: input.siteId,
      locationText: input.locationText,
      misc: input.misc,
    })
    if (!target.isMisc) {
      const siteId = requireUuid(target.siteId, '工地')
      const sites = await this.listSites(actor)
      const site = sites.find((s) => s.id === siteId)
      if (!site) throw new AppError('找不到工地／案件')
      target = { ...target, siteId: site.id, siteName: site.name }
    }
    const amount = assertPositiveMoney(input.amount, '支出金額')
    const settings = await this.getOrgSpendSettings(actor)
    const needsReview = requiresBossReview(
      amount,
      settings.reportReviewThresholdNtd,
    )
    const now = new Date().toISOString()
    const { data, error } = await sb()
      .from('expense_reports')
      .insert({
        site_id: target.siteId,
        site_name: target.siteName,
        location_text: target.locationText,
        item: assertExpenseItem(input.item),
        amount,
        note: input.note?.trim() || null,
        receipt_photo_path: input.receiptPhotoPath?.trim() || null,
        status: needsReview ? 'pending_review' : 'confirmed',
        reported_by: actor.id,
        reported_by_name: actor.name,
        reviewed_by: needsReview ? null : actor.id,
        reviewed_at: needsReview ? null : now,
        review_note: needsReview
          ? null
          : `小額免審（門檻 NT$${settings.reportReviewThresholdNtd.toLocaleString()}）`,
      })
      .select(
        'id, organization_id, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_by, reported_by_name, reported_at, reviewed_by, reviewed_at, review_note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立支出'))
    const row = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: data.site_id ? String(data.site_id) : null,
      siteName: String(data.site_name),
      locationText: (data.location_text as string | null) ?? null,
      item: String(data.item),
      amount: Number(data.amount),
      note: (data.note as string | null) ?? null,
      receiptPhotoPath: (data.receipt_photo_path as string | null) ?? null,
      status: data.status as ExpenseReport['status'],
      reportedBy: String(data.reported_by),
      reportedByName: String(data.reported_by_name),
      reportedAt: String(data.reported_at),
      reviewedBy: (data.reviewed_by as string | null) ?? null,
      reviewedAt: (data.reviewed_at as string | null) ?? null,
      reviewNote: (data.review_note as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action: 'expense.create',
      targetType: 'expense_report',
      targetId: row.id,
      after: row,
    })
    return row
  },

  async reviewExpenseReport(
    actor: AppUser,
    input: {
      id: string
      decision: 'confirm' | 'return' | 'cancel'
      note?: string | null
    },
  ): Promise<ExpenseReport> {
    const id = requireUuid(input.id, '支出')
    const current = (await this.listExpenseReports(actor)).find((e) => e.id === id)
    if (!current) throw new AppError('找不到支出回報')
    assertBossFinalize({
      actorRole: actor.role,
      actorId: actor.id,
      reporterId: current.reportedBy,
    })
    assertCanReviewExpense(current.status)
    const status =
      input.decision === 'confirm'
        ? 'confirmed'
        : input.decision === 'return'
          ? 'returned'
          : 'cancelled'
    const { data, error } = await sb()
      .from('expense_reports')
      .update({
        status,
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
        review_note: input.note?.trim() || null,
      })
      .eq('id', id)
      .select(
        'id, organization_id, site_id, site_name, item, amount, note, receipt_photo_path, status, reported_by, reported_by_name, reported_at, reviewed_by, reviewed_at, review_note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法審核支出'))
    const row = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: String(data.site_id),
      siteName: String(data.site_name),
      item: String(data.item),
      amount: Number(data.amount),
      note: (data.note as string | null) ?? null,
      receiptPhotoPath: (data.receipt_photo_path as string | null) ?? null,
      status: data.status as ExpenseReport['status'],
      reportedBy: String(data.reported_by),
      reportedByName: String(data.reported_by_name),
      reportedAt: String(data.reported_at),
      reviewedBy: (data.reviewed_by as string | null) ?? null,
      reviewedAt: (data.reviewed_at as string | null) ?? null,
      reviewNote: (data.review_note as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action:
        input.decision === 'confirm'
          ? 'expense.confirm'
          : input.decision === 'return'
            ? 'expense.return'
            : 'expense.cancel',
      targetType: 'expense_report',
      targetId: row.id,
      before: current,
      after: row,
    })
    return row
  },

  async cancelExpenseReport(
    actor: AppUser,
    input: { id: string; note?: string | null },
  ): Promise<ExpenseReport> {
    assertBossCancelFinance(actor.role)
    const id = requireUuid(input.id, '支出')
    const current = (await this.listExpenseReports(actor)).find((e) => e.id === id)
    if (!current) throw new AppError('找不到支出回報')
    assertCanCancelExpense(current.status)
    const note =
      input.note?.trim() ||
      (current.status === 'confirmed' ? '老闆刪除已確認支出' : '老闆刪除支出')
    const { data, error } = await sb()
      .from('expense_reports')
      .update({
        status: 'cancelled',
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('id', id)
      .select(
        'id, organization_id, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_by, reported_by_name, reported_at, reviewed_by, reviewed_at, review_note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法刪除支出'))
    const row: ExpenseReport = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: data.site_id ? String(data.site_id) : null,
      siteName: String(data.site_name),
      locationText: (data.location_text as string | null) ?? null,
      item: String(data.item),
      amount: Number(data.amount),
      note: (data.note as string | null) ?? null,
      receiptPhotoPath: (data.receipt_photo_path as string | null) ?? null,
      status: data.status as ExpenseReport['status'],
      reportedBy: String(data.reported_by),
      reportedByName: String(data.reported_by_name),
      reportedAt: String(data.reported_at),
      reviewedBy: (data.reviewed_by as string | null) ?? null,
      reviewedAt: (data.reviewed_at as string | null) ?? null,
      reviewNote: (data.review_note as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action: 'expense.cancel',
      targetType: 'expense_report',
      targetId: row.id,
      before: current,
      after: row,
    })
    return row
  },

  async listEmployeeAdvances(actor: AppUser): Promise<EmployeeAdvance[]> {
    let q = sb()
      .from('employee_advances')
      .select(
        'id, organization_id, employee_id, employee_name, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_at, settled_at, settled_by, expense_report_id',
      )
      .order('reported_at', { ascending: false })
      .limit(200)
    if (actor.role !== 'boss') {
      q = q.eq('employee_id', actor.id)
    }
    const { data, error } = await q
    if (error) throw new AppError(toUserMessage(error, '無法載入代墊'))
    return (data ?? []).map((row) => mapEmployeeAdvance(row))
  },

  async createEmployeeAdvance(
    actor: AppUser,
    input: {
      siteId?: string | null
      item: string
      amount: number
      note?: string | null
      locationText?: string | null
      receiptPhotoPath?: string | null
      misc?: boolean
    },
  ): Promise<EmployeeAdvance> {
    let target = resolveFieldCashTarget({
      siteId: input.siteId,
      locationText: input.locationText,
      misc: input.misc,
    })
    if (!target.isMisc) {
      const siteId = requireUuid(target.siteId, '工地')
      const sites = await this.listSites(actor)
      const site = sites.find((s) => s.id === siteId)
      if (!site) throw new AppError('找不到工地／案件')
      target = { ...target, siteId: site.id, siteName: site.name }
    }
    const amount = assertPositiveMoney(input.amount, '代墊金額')
    const { data, error } = await sb()
      .from('employee_advances')
      .insert({
        employee_id: actor.id,
        employee_name: actor.name,
        site_id: target.siteId,
        site_name: target.siteName,
        location_text: target.locationText,
        item: assertAdvanceItem(input.item),
        amount,
        note: input.note?.trim() || null,
        receipt_photo_path: input.receiptPhotoPath?.trim() || null,
        status: 'open',
      })
      .select(
        'id, organization_id, employee_id, employee_name, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_at, settled_at, settled_by, expense_report_id',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登記代墊'))
    const row = mapEmployeeAdvance(data)
    await this.appendAuditLog(actor, {
      action: 'advance.create',
      targetType: 'employee_advance',
      targetId: row.id,
      after: row,
    })
    return row
  },

  async batchSettleEmployeeAdvances(
    actor: AppUser,
    input: { advanceIds: string[]; note?: string | null },
  ): Promise<{ expense: ExpenseReport; advances: EmployeeAdvance[] }> {
    assertCanSettleAdvances({
      actorRole: actor.role,
      selectedIds: input.advanceIds,
    })
    const ids = input.advanceIds.map((id) => requireUuid(id, '代墊'))
    const all = await this.listEmployeeAdvances(actor)
    const selected = all.filter((a) => ids.includes(a.id) && a.status === 'open')
    if (selected.length === 0) throw new AppError('沒有可核銷的代墊')
    const total = selected.reduce((s, a) => s + a.amount, 0)
    const names = [...new Set(selected.map((a) => a.employeeName))].join('、')
    const now = new Date().toISOString()
    const { data: expData, error: expError } = await sb()
      .from('expense_reports')
      .insert({
        site_id: null,
        site_name: '代墊核銷',
        location_text: null,
        item: buildSettleExpenseItem(selected.length),
        amount: total,
        note:
          input.note?.trim() ||
          `核銷 ${selected.length} 筆代墊（${names}）`,
        receipt_photo_path: null,
        status: 'confirmed',
        reported_by: actor.id,
        reported_by_name: actor.name,
        reviewed_by: actor.id,
        reviewed_at: now,
        review_note: '代墊批量核銷',
      })
      .select(
        'id, organization_id, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_by, reported_by_name, reported_at, reviewed_by, reviewed_at, review_note',
      )
      .single()
    if (expError) {
      throw new AppError(toUserMessage(expError, '無法建立核銷支出'))
    }
    const expense: ExpenseReport = {
      id: String(expData.id),
      organizationId: String(expData.organization_id),
      siteId: expData.site_id ? String(expData.site_id) : null,
      siteName: String(expData.site_name),
      locationText: (expData.location_text as string | null) ?? null,
      item: String(expData.item),
      amount: Number(expData.amount),
      note: (expData.note as string | null) ?? null,
      receiptPhotoPath: (expData.receipt_photo_path as string | null) ?? null,
      status: expData.status as ExpenseReport['status'],
      reportedBy: String(expData.reported_by),
      reportedByName: String(expData.reported_by_name),
      reportedAt: String(expData.reported_at),
      reviewedBy: (expData.reviewed_by as string | null) ?? null,
      reviewedAt: (expData.reviewed_at as string | null) ?? null,
      reviewNote: (expData.review_note as string | null) ?? null,
    }

    const { error: updError } = await sb()
      .from('employee_advances')
      .update({
        status: 'settled',
        settled_at: now,
        settled_by: actor.id,
        expense_report_id: expense.id,
      })
      .in(
        'id',
        selected.map((a) => a.id),
      )
      .eq('status', 'open')
    if (updError) {
      throw new AppError(toUserMessage(updError, '代墊核銷狀態更新失敗'))
    }

    const advances = (await this.listEmployeeAdvances(actor)).filter((a) =>
      selected.some((s) => s.id === a.id),
    )
    await this.appendAuditLog(actor, {
      action: 'advance.settle',
      targetType: 'employee_advance',
      targetId: expense.id,
      after: { expenseId: expense.id, advanceIds: selected.map((a) => a.id), total },
    })
    return { expense, advances }
  },

  async cancelEmployeeAdvance(
    actor: AppUser,
    input: { id: string; note?: string | null },
  ): Promise<EmployeeAdvance> {
    const id = requireUuid(input.id, '代墊')
    const current = (await this.listEmployeeAdvances(actor)).find((a) => a.id === id)
    if (!current) throw new AppError('找不到代墊')
    assertCanCancelAdvance({ actorRole: actor.role, status: current.status })

    if (current.status === 'settled' && current.expenseReportId) {
      const linked = (await this.listExpenseReports(actor)).find(
        (e) => e.id === current.expenseReportId,
      )
      if (linked && linked.status !== 'cancelled') {
        await this.cancelExpenseReport(actor, {
          id: linked.id,
          note: input.note?.trim() || '取消代墊核銷連帶取消支出',
        })
      }
    }

    const { data, error } = await sb()
      .from('employee_advances')
      .update({
        status: 'cancelled',
        note:
          input.note?.trim() ||
          current.note ||
          (current.status === 'settled' ? '老闆取消已核銷代墊' : '老闆取消代墊'),
      })
      .eq('id', id)
      .select(
        'id, organization_id, employee_id, employee_name, site_id, site_name, location_text, item, amount, note, receipt_photo_path, status, reported_at, settled_at, settled_by, expense_report_id',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法取消代墊'))
    const row = mapEmployeeAdvance(data)
    await this.appendAuditLog(actor, {
      action: 'advance.cancel',
      targetType: 'employee_advance',
      targetId: row.id,
      before: current,
      after: row,
    })
    return row
  },

  async listCashReceipts(actor: AppUser): Promise<CashReceiptReport[]> {
    let q = sb()
      .from('cash_receipt_reports')
      .select(
        'id, organization_id, site_id, site_name, location_text, amount, source_note, proof_photo_path, status, reported_by, reported_by_name, reported_at, confirmed_by, confirmed_at, confirm_note',
      )
    if (actor.role !== 'boss') q = q.eq('reported_by', actor.id)
    const { data, error } = await q.order('reported_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入收款'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      siteId: row.site_id ? String(row.site_id) : null,
      siteName: String(row.site_name),
      locationText: (row.location_text as string | null) ?? null,
      amount: Number(row.amount),
      sourceNote: (row.source_note as string | null) ?? null,
      proofPhotoPath: (row.proof_photo_path as string | null) ?? null,
      status: row.status as CashReceiptReport['status'],
      reportedBy: String(row.reported_by),
      reportedByName: String(row.reported_by_name),
      reportedAt: String(row.reported_at),
      confirmedBy: (row.confirmed_by as string | null) ?? null,
      confirmedAt: (row.confirmed_at as string | null) ?? null,
      confirmNote: (row.confirm_note as string | null) ?? null,
    }))
  },

  async createCashReceipt(
    actor: AppUser,
    input: {
      siteId?: string | null
      amount: number
      sourceNote?: string | null
      locationText?: string | null
      proofPhotoPath?: string | null
      misc?: boolean
    },
  ): Promise<CashReceiptReport> {
    let target = resolveFieldCashTarget({
      siteId: input.siteId,
      locationText: input.locationText,
      misc: input.misc,
    })
    if (!target.isMisc) {
      const siteId = requireUuid(target.siteId, '工地')
      const sites = await this.listSites(actor)
      const site = sites.find((s) => s.id === siteId)
      if (!site) throw new AppError('找不到工地／案件')
      target = { ...target, siteId: site.id, siteName: site.name }
    }
    const { data, error } = await sb()
      .from('cash_receipt_reports')
      .insert({
        site_id: target.siteId,
        site_name: target.siteName,
        location_text: target.locationText,
        amount: assertPositiveMoney(input.amount, '收款金額'),
        source_note: input.sourceNote?.trim() || null,
        proof_photo_path: input.proofPhotoPath?.trim() || null,
        status: 'pending_confirm',
        reported_by: actor.id,
        reported_by_name: actor.name,
      })
      .select(
        'id, organization_id, site_id, site_name, location_text, amount, source_note, proof_photo_path, status, reported_by, reported_by_name, reported_at, confirmed_by, confirmed_at, confirm_note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立收款'))
    const row = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: data.site_id ? String(data.site_id) : null,
      siteName: String(data.site_name),
      locationText: (data.location_text as string | null) ?? null,
      amount: Number(data.amount),
      sourceNote: (data.source_note as string | null) ?? null,
      proofPhotoPath: (data.proof_photo_path as string | null) ?? null,
      status: data.status as CashReceiptReport['status'],
      reportedBy: String(data.reported_by),
      reportedByName: String(data.reported_by_name),
      reportedAt: String(data.reported_at),
      confirmedBy: (data.confirmed_by as string | null) ?? null,
      confirmedAt: (data.confirmed_at as string | null) ?? null,
      confirmNote: (data.confirm_note as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action: 'receipt.create',
      targetType: 'cash_receipt',
      targetId: row.id,
      after: row,
    })
    return row
  },

  async confirmCashReceipt(
    actor: AppUser,
    input: {
      id: string
      decision: 'confirm' | 'return' | 'cancel'
      note?: string | null
    },
  ): Promise<CashReceiptReport> {
    const id = requireUuid(input.id, '收款')
    const current = (await this.listCashReceipts(actor)).find((e) => e.id === id)
    if (!current) throw new AppError('找不到收款回報')
    assertBossFinalize({
      actorRole: actor.role,
      actorId: actor.id,
      reporterId: current.reportedBy,
    })
    assertCanConfirmReceipt(current.status)
    const status =
      input.decision === 'confirm'
        ? 'confirmed'
        : input.decision === 'return'
          ? 'returned'
          : 'cancelled'
    const { data, error } = await sb()
      .from('cash_receipt_reports')
      .update({
        status,
        confirmed_by: actor.id,
        confirmed_at: new Date().toISOString(),
        confirm_note: input.note?.trim() || null,
      })
      .eq('id', id)
      .select(
        'id, organization_id, site_id, site_name, amount, source_note, proof_photo_path, status, reported_by, reported_by_name, reported_at, confirmed_by, confirmed_at, confirm_note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法確認收款'))
    const row = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: String(data.site_id),
      siteName: String(data.site_name),
      amount: Number(data.amount),
      sourceNote: (data.source_note as string | null) ?? null,
      proofPhotoPath: (data.proof_photo_path as string | null) ?? null,
      status: data.status as CashReceiptReport['status'],
      reportedBy: String(data.reported_by),
      reportedByName: String(data.reported_by_name),
      reportedAt: String(data.reported_at),
      confirmedBy: (data.confirmed_by as string | null) ?? null,
      confirmedAt: (data.confirmed_at as string | null) ?? null,
      confirmNote: (data.confirm_note as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action:
        input.decision === 'confirm'
          ? 'receipt.confirm'
          : input.decision === 'return'
            ? 'receipt.return'
            : 'receipt.cancel',
      targetType: 'cash_receipt',
      targetId: row.id,
      before: current,
      after: row,
    })
    return row
  },

  async cancelCashReceipt(
    actor: AppUser,
    input: { id: string; note?: string | null },
  ): Promise<CashReceiptReport> {
    assertBossCancelFinance(actor.role)
    const id = requireUuid(input.id, '收款')
    const current = (await this.listCashReceipts(actor)).find((e) => e.id === id)
    if (!current) throw new AppError('找不到收款回報')
    assertCanCancelReceipt(current.status)
    const note =
      input.note?.trim() ||
      (current.status === 'confirmed' ? '老闆刪除已確認收款' : '老闆刪除收款')
    const { data, error } = await sb()
      .from('cash_receipt_reports')
      .update({
        status: 'cancelled',
        confirmed_by: actor.id,
        confirmed_at: new Date().toISOString(),
        confirm_note: note,
      })
      .eq('id', id)
      .select(
        'id, organization_id, site_id, site_name, location_text, amount, source_note, proof_photo_path, status, reported_by, reported_by_name, reported_at, confirmed_by, confirmed_at, confirm_note',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法刪除收款'))
    const row: CashReceiptReport = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: data.site_id ? String(data.site_id) : null,
      siteName: String(data.site_name),
      locationText: (data.location_text as string | null) ?? null,
      amount: Number(data.amount),
      sourceNote: (data.source_note as string | null) ?? null,
      proofPhotoPath: (data.proof_photo_path as string | null) ?? null,
      status: data.status as CashReceiptReport['status'],
      reportedBy: String(data.reported_by),
      reportedByName: String(data.reported_by_name),
      reportedAt: String(data.reported_at),
      confirmedBy: (data.confirmed_by as string | null) ?? null,
      confirmedAt: (data.confirmed_at as string | null) ?? null,
      confirmNote: (data.confirm_note as string | null) ?? null,
    }
    await this.appendAuditLog(actor, {
      action: 'receipt.cancel',
      targetType: 'cash_receipt',
      targetId: row.id,
      before: current,
      after: row,
    })
    return row
  },

  async listSuppliers(): Promise<Supplier[]> {
    const { data, error } = await sb()
      .from('suppliers')
      .select(
        'id, organization_id, name, credit_limit, payment_terms_days, notes, created_at, updated_at',
      )
      .order('name', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入供應商'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      name: String(row.name),
      creditLimit:
        row.credit_limit == null ? null : Number(row.credit_limit),
      paymentTermsDays: Number(row.payment_terms_days),
      notes: (row.notes as string | null) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }))
  },

  async createSupplier(
    actor: AppUser,
    input: {
      name: string
      creditLimit?: number | null
      paymentTermsDays?: number
      notes?: string | null
    },
  ): Promise<Supplier> {
    void actor
    const { data, error } = await sb()
      .from('suppliers')
      .insert({
        name: assertSupplierName(input.name),
        credit_limit:
          input.creditLimit == null || Number(input.creditLimit) <= 0
            ? null
            : roundMoney(Number(input.creditLimit)),
        payment_terms_days: Math.max(0, Number(input.paymentTermsDays) || 30),
        notes: input.notes?.trim() || null,
      })
      .select(
        'id, organization_id, name, credit_limit, payment_terms_days, notes, created_at, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立供應商'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      name: String(data.name),
      creditLimit: data.credit_limit == null ? null : Number(data.credit_limit),
      paymentTermsDays: Number(data.payment_terms_days),
      notes: (data.notes as string | null) ?? null,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    }
  },

  async linkPurchaseSupplier(
    actor: AppUser,
    input: { purchaseId: string; supplierId: string },
  ): Promise<PurchaseRecord> {
    const purchaseId = requireUuid(input.purchaseId, '採購')
    const supplierId = requireUuid(input.supplierId, '供應商')
    const suppliers = await this.listSuppliers()
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (!supplier) throw new AppError('找不到供應商')
    const purchases = await this.listPurchases(actor)
    const purchase = purchases.find((p) => p.id === purchaseId)
    if (!purchase) throw new AppError('找不到採購')
    const related = purchases.filter((p) => p.supplierId === supplierId)
    const exposure = sumSupplierExposure(related)
    const nextAmount =
      purchase.supplierId === supplierId ? 0 : purchase.finalPayable
    assertWithinCreditLimit({
      creditLimit: supplier.creditLimit,
      exposure: exposure.exposure,
      nextAmount,
    })
    const { data, error } = await sb()
      .from('purchases')
      .update({ supplier_id: supplierId })
      .eq('id', purchaseId)
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法關聯供應商'))
    return mapPurchase(data as Record<string, unknown>)
  },

  async markPurchasePaid(
    actor: AppUser,
    purchaseId: string,
  ): Promise<PurchaseRecord> {
    const pid = requireUuid(purchaseId, '採購')
    const purchase = (await this.listPurchases(actor)).find((p) => p.id === pid)
    if (!purchase) throw new AppError('找不到採購')
    if (!purchase.inboundAt) throw new AppError('僅已收貨應付可標記付款')
    if (purchase.paidAt) throw new AppError('此採購已標記付款')
    const { data, error } = await sb()
      .from('purchases')
      .update({ paid_at: new Date().toISOString() })
      .eq('id', pid)
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法標記付款'))
    return mapPurchase(data as Record<string, unknown>)
  },

  async listPettyCashAccounts(): Promise<PettyCashAccount[]> {
    const { data, error } = await sb()
      .from('petty_cash_accounts')
      .select(
        'id, organization_id, custodian_user_id, label, balance, updated_at',
      )
      .order('label', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入零用金帳戶'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      custodianUserId: String(row.custodian_user_id),
      label: String(row.label),
      balance: Number(row.balance),
      updatedAt: String(row.updated_at),
    }))
  },

  async listPettyCashRequests(): Promise<PettyCashTopUpRequest[]> {
    const { data, error } = await sb()
      .from('petty_cash_top_up_requests')
      .select(
        'id, organization_id, account_id, amount, reason, status, requested_by, requested_at, approved_by, approved_at, rejected_reason, disbursement_id',
      )
      .order('requested_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入補充申請'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      accountId: String(row.account_id),
      amount: Number(row.amount),
      reason: String(row.reason),
      status: row.status as PettyCashTopUpRequest['status'],
      requestedBy: String(row.requested_by),
      requestedAt: String(row.requested_at),
      approvedBy: (row.approved_by as string | null) ?? null,
      approvedAt: (row.approved_at as string | null) ?? null,
      rejectedReason: (row.rejected_reason as string | null) ?? null,
      disbursementId: (row.disbursement_id as string | null) ?? null,
    }))
  },

  async listPettyCashLedger(accountId?: string): Promise<PettyCashLedgerEntry[]> {
    let q = sb()
      .from('petty_cash_ledger_entries')
      .select(
        'id, organization_id, account_id, entry_type, amount, balance_after, source_type, source_id, note, posted_at, created_by',
      )
    if (accountId) q = q.eq('account_id', requireUuid(accountId, '帳戶'))
    const { data, error } = await q.order('posted_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入零用金流水'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      accountId: String(row.account_id),
      entryType: row.entry_type as PettyCashLedgerEntry['entryType'],
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      sourceType: row.source_type as PettyCashLedgerEntry['sourceType'],
      sourceId: String(row.source_id),
      note: (row.note as string | null) ?? null,
      postedAt: String(row.posted_at),
      createdBy: String(row.created_by ?? ''),
    }))
  },

  async requestPettyCashTopUp(
    actor: AppUser,
    input: { accountId: string; amount: number; reason: string },
  ): Promise<PettyCashTopUpRequest> {
    assertCanRequest(actor.role)
    const amount = assertTopUpAmount(input.amount)
    const reason = input.reason.trim()
    if (!reason) throw new AppError('請填寫補充原因')
    const { data, error } = await sb()
      .from('petty_cash_top_up_requests')
      .insert({
        account_id: requireUuid(input.accountId, '帳戶'),
        amount,
        reason,
        status: 'pending_approval',
        requested_by: actor.id,
      })
      .select(
        'id, organization_id, account_id, amount, reason, status, requested_by, requested_at, approved_by, approved_at, rejected_reason, disbursement_id',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法送出申請'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      accountId: String(data.account_id),
      amount: Number(data.amount),
      reason: String(data.reason),
      status: data.status as PettyCashTopUpRequest['status'],
      requestedBy: String(data.requested_by),
      requestedAt: String(data.requested_at),
      approvedBy: (data.approved_by as string | null) ?? null,
      approvedAt: (data.approved_at as string | null) ?? null,
      rejectedReason: (data.rejected_reason as string | null) ?? null,
      disbursementId: (data.disbursement_id as string | null) ?? null,
    }
  },

  async approvePettyCashTopUp(
    actor: AppUser,
    requestId: string,
  ): Promise<PettyCashTopUpRequest> {
    assertCanApprove(actor.role)
    const rid = requireUuid(requestId, '申請')
    const requests = await this.listPettyCashRequests()
    const current = requests.find((r) => r.id === rid)
    if (!current) throw new AppError('找不到申請')
    assertRequestApprovable(current.status)
    const accounts = await this.listPettyCashAccounts()
    const account = accounts.find((a) => a.id === current.accountId)
    if (!account) throw new AppError('找不到零用金帳戶')
    const balanceBefore = account.balance
    const { data, error } = await sb()
      .from('petty_cash_top_up_requests')
      .update({
        status: 'approved',
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', rid)
      .select(
        'id, organization_id, account_id, amount, reason, status, requested_by, requested_at, approved_by, approved_at, rejected_reason, disbursement_id',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法核准'))
    const afterAccounts = await this.listPettyCashAccounts()
    const after = afterAccounts.find((a) => a.id === current.accountId)
    assertApproveDoesNotCreditBalance({
      balanceBefore,
      balanceAfterApprove: after?.balance ?? balanceBefore,
    })
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      accountId: String(data.account_id),
      amount: Number(data.amount),
      reason: String(data.reason),
      status: data.status as PettyCashTopUpRequest['status'],
      requestedBy: String(data.requested_by),
      requestedAt: String(data.requested_at),
      approvedBy: (data.approved_by as string | null) ?? null,
      approvedAt: (data.approved_at as string | null) ?? null,
      rejectedReason: (data.rejected_reason as string | null) ?? null,
      disbursementId: (data.disbursement_id as string | null) ?? null,
    }
  },

  async rejectPettyCashTopUp(
    actor: AppUser,
    input: { requestId: string; reason: string },
  ): Promise<PettyCashTopUpRequest> {
    assertCanApprove(actor.role)
    const rid = requireUuid(input.requestId, '申請')
    const current = (await this.listPettyCashRequests()).find((r) => r.id === rid)
    if (!current) throw new AppError('找不到申請')
    assertRequestApprovable(current.status)
    const { data, error } = await sb()
      .from('petty_cash_top_up_requests')
      .update({
        status: 'rejected',
        approved_by: actor.id,
        approved_at: new Date().toISOString(),
        rejected_reason: input.reason.trim() || '駁回',
      })
      .eq('id', rid)
      .select(
        'id, organization_id, account_id, amount, reason, status, requested_by, requested_at, approved_by, approved_at, rejected_reason, disbursement_id',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法駁回'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      accountId: String(data.account_id),
      amount: Number(data.amount),
      reason: String(data.reason),
      status: data.status as PettyCashTopUpRequest['status'],
      requestedBy: String(data.requested_by),
      requestedAt: String(data.requested_at),
      approvedBy: (data.approved_by as string | null) ?? null,
      approvedAt: (data.approved_at as string | null) ?? null,
      rejectedReason: (data.rejected_reason as string | null) ?? null,
      disbursementId: (data.disbursement_id as string | null) ?? null,
    }
  },

  async disbursePettyCashTopUp(
    actor: AppUser,
    input: { requestId: string; note?: string | null },
  ): Promise<PettyCashDisbursement> {
    assertCanDisburse(actor.role)
    const rid = requireUuid(input.requestId, '申請')
    const request = (await this.listPettyCashRequests()).find((r) => r.id === rid)
    if (!request) throw new AppError('找不到申請')
    assertRequestDisbursable(request.status)
    const accounts = await this.listPettyCashAccounts()
    const account = accounts.find((a) => a.id === request.accountId)
    if (!account) throw new AppError('找不到零用金帳戶')
    const nextBalance = applyDisbursementCredit({
      balance: account.balance,
      amount: request.amount,
    })
    const { data: disbursement, error: dError } = await sb()
      .from('petty_cash_disbursements')
      .insert({
        request_id: rid,
        account_id: requireUuid(account.id, '帳戶'),
        amount: request.amount,
        disbursed_by: actor.id,
        note: input.note?.trim() || null,
      })
      .select(
        'id, organization_id, request_id, account_id, amount, disbursed_by, disbursed_at, note',
      )
      .single()
    if (dError) throw new AppError(toUserMessage(dError, '無法撥款'))
    const { error: balError } = await sb()
      .from('petty_cash_accounts')
      .update({
        balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
    if (balError) throw new AppError(toUserMessage(balError, '無法更新餘額'))
    const { error: reqError } = await sb()
      .from('petty_cash_top_up_requests')
      .update({
        status: 'disbursed',
        disbursement_id: disbursement.id,
      })
      .eq('id', rid)
    if (reqError) throw new AppError(toUserMessage(reqError, '無法更新申請狀態'))
    const { error: ledError } = await sb().from('petty_cash_ledger_entries').insert({
      account_id: account.id,
      entry_type: 'top_up',
      amount: request.amount,
      balance_after: nextBalance,
      source_type: 'disbursement',
      source_id: disbursement.id,
      note: input.note?.trim() || `補充申請 ${rid}`,
      created_by: actor.id,
    })
    if (ledError) throw new AppError(toUserMessage(ledError, '無法寫入流水'))
    return {
      id: String(disbursement.id),
      organizationId: String(disbursement.organization_id),
      requestId: String(disbursement.request_id),
      accountId: String(disbursement.account_id),
      amount: Number(disbursement.amount),
      disbursedBy: String(disbursement.disbursed_by),
      disbursedAt: String(disbursement.disbursed_at),
      note: (disbursement.note as string | null) ?? null,
    }
  },

  async createMaterial(
    actor: AppUser,
    input: {
      name: string
      unit: string
      sku?: string
      trackingMode?: MaterialStock['trackingMode']
    },
  ): Promise<MaterialStock> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_INBOUND, {
      financeAuthorized: actor.financeAuthorized,
    })
    const name = input.name.trim()
    const unit = input.unit.trim() || '式'
    if (!name) throw new AppError('請填寫材料名稱')
    const existing = await this.listMaterials(actor)
    const sku = assertSkuUniqueInOrg({
      sku: input.sku || name.slice(0, 12),
      existingSkus: existing.map((m) => m.sku || '').filter(Boolean),
    })
    const trackingMode = input.trackingMode || 'quantity'
    const { data, error } = await sb()
      .from('materials')
      .insert({
        organization_id: actor.organizationId,
        name,
        unit,
        qty: 0,
        unit_cost: 0,
        sku,
        tracking_mode: trackingMode,
        base_unit_code: unit,
      })
      .select(
        'id, organization_id, name, unit, qty, unit_cost, sku, tracking_mode, base_unit_code, updated_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立材料'))
    await sb().from('material_units').insert({
      material_id: data.id,
      code: unit,
      label: unit,
      factor_to_base: 1,
      is_base: true,
    })
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      name: String(data.name),
      unit: String(data.unit),
      qty: Number(data.qty),
      unitCost: Number(data.unit_cost),
      sku: data.sku ? String(data.sku) : sku,
      trackingMode:
        (data.tracking_mode as MaterialStock['trackingMode']) || trackingMode,
      baseUnitCode: data.base_unit_code
        ? String(data.base_unit_code)
        : unit,
      reservedQty: 0,
      availableQty: 0,
      updatedAt: String(data.updated_at),
    }
  },

  async purchaseInbound(
    actor: AppUser,
    input: {
      purchaseId: string
      materialId: string
      qty: number
      unitCost?: number
    },
  ): Promise<PurchaseRecord> {
    const pid = requireUuid(input.purchaseId, '採購')
    const { data: current, error: loadError } = await sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .eq('id', pid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取採購'))
    if (!current) throw new AppError('找不到採購')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    if (!['approved', 'purchased'].includes(String(current.status))) {
      throw new AppError('僅已核准／已採購單可入庫')
    }
    if (current.inbound_at) throw new AppError('此採購已入庫，不可重複入庫')

    const qty = input.qty
    if (qty <= 0) throw new AppError('入庫數量必須大於 0')
    const unitCost =
      input.unitCost != null && input.unitCost >= 0
        ? input.unitCost
        : Number(current.goods_amount) / qty

    await this.inboundMaterial(actor, {
      materialId: input.materialId,
      qty,
      unitCost,
    })

    const { data, error } = await sb()
      .from('purchases')
      .update({
        status: 'purchased',
        inbound_material_id: requireUuid(input.materialId, '材料'),
        inbound_qty: qty,
        inbound_at: new Date().toISOString(),
      })
      .eq('id', pid)
      .select(
        'id, organization_id, user_id, site_id, supplier_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at, paid_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '入庫標記失敗'))
    return mapPurchase(data)
  },

  async createRepairCase(
    actor: AppUser,
    input: {
      problemDescription: string
      customerName?: string | null
      customerId?: string | null
      siteId?: string | null
      /** @deprecated use problemDescription */
      title?: string
    },
  ): Promise<RepairCase> {
    const problemDescription = assertProblemDescription(
      input.problemDescription || input.title || '',
    )
    const caseNumber = `RC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
    const { data, error } = await sb()
      .from('repair_cases')
      .insert({
        organization_id: actor.organizationId,
        case_number: caseNumber,
        problem_description: problemDescription,
        title: problemDescription,
        status: 'pending_schedule',
        customer_name: input.customerName?.trim() || null,
        customer_id: optionalUuid(input.customerId, '客戶'),
        site_id: optionalUuid(input.siteId, '工地'),
        created_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .select(
        'id, organization_id, case_number, problem_description, title, status, site_id, customer_id, customer_name, created_at, updated_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立維修案件'))
    return mapRepairCaseRow(data as Record<string, unknown>)
  },

  async listRepairAssignments(
    repairCaseId: string,
  ): Promise<RepairAssignment[]> {
    const rid = requireUuid(repairCaseId, '維修案件')
    const { data, error } = await sb()
      .from('repair_assignments')
      .select(
        'id, organization_id, repair_case_id, assignee_user_id, assignee_name, note, assigned_at, created_by',
      )
      .eq('repair_case_id', rid)
      .order('assigned_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入派工'))
    return (data ?? []).map((row) =>
      mapRepairAssignmentRow(row as Record<string, unknown>),
    )
  },

  async assignRepair(
    actor: AppUser,
    input: {
      repairCaseId: string
      assigneeUserId: string
      assigneeName: string
      note?: string | null
    },
  ): Promise<RepairAssignment> {
    const rid = requireUuid(input.repairCaseId, '維修案件')
    const cases = await this.listRepairCases()
    const repair = cases.find((c) => c.id === rid)
    if (!repair) throw new AppError('找不到維修案件')
    const { data, error } = await sb()
      .from('repair_assignments')
      .insert({
        repair_case_id: rid,
        assignee_user_id: requireUuid(input.assigneeUserId, '指派人員'),
        assignee_name: input.assigneeName.trim() || '未命名',
        note: input.note?.trim() || null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, repair_case_id, assignee_user_id, assignee_name, note, assigned_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法派工'))
    const next = nextRepairStatusAfterDispatch(repair.status)
    if (next !== repair.status) {
      await sb()
        .from('repair_cases')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', rid)
    }
    return mapRepairAssignmentRow(data as Record<string, unknown>)
  },

  async listRepairVisits(repairCaseId: string): Promise<RepairVisit[]> {
    const rid = requireUuid(repairCaseId, '維修案件')
    const { data, error } = await sb()
      .from('repair_visits')
      .select(
        'id, organization_id, repair_case_id, visitor_user_id, visitor_name, note, visited_at, created_by, attendance_created',
      )
      .eq('repair_case_id', rid)
      .order('visited_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入到場紀錄'))
    return (data ?? []).map((row) =>
      mapRepairVisitRow(row as Record<string, unknown>),
    )
  },

  async recordRepairVisit(
    actor: AppUser,
    input: {
      repairCaseId: string
      note?: string | null
      visitedAt?: string
    },
  ): Promise<RepairVisit> {
    if (visitCreatesAttendance()) {
      throw new AppError('內部錯誤：到場不得建立出勤')
    }
    const rid = requireUuid(input.repairCaseId, '維修案件')
    const cases = await this.listRepairCases()
    const repair = cases.find((c) => c.id === rid)
    if (!repair) throw new AppError('找不到維修案件')
    const { data, error } = await sb()
      .from('repair_visits')
      .insert({
        repair_case_id: rid,
        visitor_user_id: actor.id,
        visitor_name: actor.name,
        note: input.note?.trim() || null,
        visited_at: input.visitedAt || new Date().toISOString(),
        created_by: actor.id,
        attendance_created: false,
      })
      .select(
        'id, organization_id, repair_case_id, visitor_user_id, visitor_name, note, visited_at, created_by, attendance_created',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法記錄到場'))
    const next = nextRepairStatusAfterVisit(repair.status)
    if (next !== repair.status) {
      await sb()
        .from('repair_cases')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', rid)
    }
    return mapRepairVisitRow(data as Record<string, unknown>)
  },

  async setRepairCaseStatus(
    actor: AppUser,
    repairCaseId: string,
    status: RepairCaseStatus,
  ): Promise<void> {
    const rid = requireUuid(repairCaseId, '維修案件')
    const { error } = await sb()
      .from('repair_cases')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', rid)
    if (error) throw new AppError(toUserMessage(error, '無法更新維修狀態'))
    void actor
  },

  async listWarranties(): Promise<Warranty[]> {
    const { data, error } = await sb()
      .from('warranties')
      .select(
        'id, organization_id, title, site_id, repair_case_id, starts_on, ends_on, scope_notes, exclusion_notes, created_at, created_by',
      )
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入保固'))
    return (data ?? []).map((row) =>
      mapWarrantyRow(row as Record<string, unknown>),
    )
  },

  async createWarranty(
    actor: AppUser,
    input: {
      title: string
      siteId?: string | null
      repairCaseId?: string | null
      startsOn?: string | null
      endsOn?: string | null
      scopeNotes?: string | null
      exclusionNotes?: string | null
    },
  ): Promise<Warranty> {
    const title = input.title.trim()
    if (!title) throw new AppError('保固標題為必填')
    const { data, error } = await sb()
      .from('warranties')
      .insert({
        title,
        site_id: optionalUuid(input.siteId, '工地'),
        repair_case_id: optionalUuid(input.repairCaseId, '維修案件'),
        starts_on: input.startsOn || null,
        ends_on: input.endsOn || null,
        scope_notes: input.scopeNotes?.trim() || null,
        exclusion_notes: input.exclusionNotes?.trim() || null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, title, site_id, repair_case_id, starts_on, ends_on, scope_notes, exclusion_notes, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立保固'))
    return mapWarrantyRow(data as Record<string, unknown>)
  },

  async listWarrantyAssessments(
    repairCaseId: string,
  ): Promise<WarrantyAssessment[]> {
    const rid = requireUuid(repairCaseId, '維修案件')
    const { data, error } = await sb()
      .from('warranty_assessments')
      .select(
        'id, organization_id, repair_case_id, warranty_id, classification, rationale, assessed_at, assessed_by, assessed_by_name',
      )
      .eq('repair_case_id', rid)
      .order('assessed_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入保固判定'))
    return (data ?? []).map((row) =>
      mapWarrantyAssessmentRow(row as Record<string, unknown>),
    )
  },

  async createWarrantyAssessment(
    actor: AppUser,
    input: {
      repairCaseId: string
      warrantyId?: string | null
      classification: WarrantyAssessmentClassification
      rationale: string
    },
  ): Promise<WarrantyAssessment> {
    const rid = requireUuid(input.repairCaseId, '維修案件')
    const warranties = await this.listWarranties()
    const warranty = input.warrantyId
      ? warranties.find((w) => w.id === input.warrantyId)
      : null
    if (
      isAutoFreeByWarrantyDates({
        now: new Date().toISOString(),
        warrantyStart: warranty?.startsOn,
        warrantyEnd: warranty?.endsOn,
      })
    ) {
      throw new AppError('不可依保固日期自動免費')
    }
    const rationale = assertWarrantyAssessmentRationale(input.rationale)
    const { data, error } = await sb()
      .from('warranty_assessments')
      .insert({
        repair_case_id: rid,
        warranty_id: optionalUuid(input.warrantyId, '保固'),
        classification: input.classification,
        rationale,
        assessed_by: actor.id,
        assessed_by_name: actor.name,
      })
      .select(
        'id, organization_id, repair_case_id, warranty_id, classification, rationale, assessed_at, assessed_by, assessed_by_name',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法登錄保固判定'))
    return mapWarrantyAssessmentRow(data as Record<string, unknown>)
  },

  async listComplaints(): Promise<Complaint[]> {
    const { data, error } = await sb()
      .from('complaints')
      .select(
        'id, organization_id, subject, detail, status, site_id, repair_case_id, customer_name, created_at, updated_at, created_by',
      )
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入客訴'))
    return (data ?? []).map((row) =>
      mapComplaintRow(row as Record<string, unknown>),
    )
  },

  async createComplaint(
    actor: AppUser,
    input: {
      subject: string
      detail?: string | null
      siteId?: string | null
      repairCaseId?: string | null
      customerName?: string | null
    },
  ): Promise<Complaint> {
    const subject = assertComplaintSubject(input.subject)
    const { data, error } = await sb()
      .from('complaints')
      .insert({
        subject,
        detail: input.detail?.trim() || null,
        status: 'open',
        site_id: optionalUuid(input.siteId, '工地'),
        repair_case_id: optionalUuid(input.repairCaseId, '維修案件'),
        customer_name: input.customerName?.trim() || null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, subject, detail, status, site_id, repair_case_id, customer_name, created_at, updated_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立客訴'))
    return mapComplaintRow(data as Record<string, unknown>)
  },

  async setComplaintStatus(
    actor: AppUser,
    complaintId: string,
    status: ComplaintStatus,
  ): Promise<void> {
    const cid = requireUuid(complaintId, '客訴')
    const { error } = await sb()
      .from('complaints')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', cid)
    if (error) throw new AppError(toUserMessage(error, '無法更新客訴狀態'))
    void actor
  },

  async listRelatedRepairCases(
    repairCaseId: string,
  ): Promise<RelatedRepairCase[]> {
    const rid = requireUuid(repairCaseId, '維修案件')
    const { data, error } = await sb()
      .from('related_repair_cases')
      .select(
        'id, organization_id, from_repair_case_id, to_repair_case_id, note, created_at, created_by',
      )
      .or(`from_repair_case_id.eq.${rid},to_repair_case_id.eq.${rid}`)
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入關聯案件'))
    return (data ?? []).map((row) =>
      mapRelatedRepairCaseRow(row as Record<string, unknown>),
    )
  },

  async linkRelatedRepairCases(
    actor: AppUser,
    input: {
      fromRepairCaseId: string
      toRepairCaseId: string
      note?: string | null
    },
  ): Promise<RelatedRepairCase> {
    const fromId = requireUuid(input.fromRepairCaseId, '來源維修')
    const toId = requireUuid(input.toRepairCaseId, '目標維修')
    assertDistinctRelatedCases(fromId, toId)
    const policy = assertRelatedCasesAreAssociationOnly({
      fromRepairCaseId: fromId,
      toRepairCaseId: toId,
    })
    if (policy.mergesCases || policy.deletesCases) {
      throw new AppError('禁止合併或刪除原始維修案件')
    }
    const { data, error } = await sb()
      .from('related_repair_cases')
      .insert({
        from_repair_case_id: fromId,
        to_repair_case_id: toId,
        note: input.note?.trim() || null,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, from_repair_case_id, to_repair_case_id, note, created_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法關聯維修案件'))
    return mapRelatedRepairCaseRow(data as Record<string, unknown>)
  },

  async listSiteDefects(siteId: string): Promise<SiteDefect[]> {
    const sid = requireUuid(siteId, '工地')
    const { data, error } = await sb()
      .from('site_defects')
      .select(
        'id, organization_id, site_id, reported_by, title, detail, severity, status, fixed_at, fixed_note, reinspected_at, reinspect_note, closed_at, created_at',
      )
      .eq('site_id', sid)
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入缺失'))

    const rows = data ?? []
    const reporterIds = [...new Set(rows.map((r) => String(r.reported_by)))]
    const names = new Map<string, string>()
    if (reporterIds.length > 0) {
      const { data: profiles } = await sb()
        .from('profiles')
        .select('id, name')
        .in('id', reporterIds)
      for (const p of profiles ?? []) names.set(String(p.id), String(p.name))
    }

    return rows.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      siteId: String(row.site_id),
      reportedBy: String(row.reported_by),
      reporterName: names.get(String(row.reported_by)),
      title: String(row.title),
      detail: String(row.detail ?? ''),
      severity: row.severity as SiteDefect['severity'],
      status: row.status as SiteDefect['status'],
      fixedAt: (row.fixed_at as string | null) ?? null,
      fixedNote: (row.fixed_note as string | null) ?? null,
      reinspectedAt: (row.reinspected_at as string | null) ?? null,
      reinspectNote: (row.reinspect_note as string | null) ?? null,
      closedAt: (row.closed_at as string | null) ?? null,
      createdAt: String(row.created_at),
    }))
  },

  async createSiteDefect(input: {
    siteId: string
    title: string
    detail?: string
    severity?: DefectSeverity
  }): Promise<SiteDefect> {
    const me = await this.getCurrentUser()
    if (!me) throw new AppError('尚未登入')
    const title = input.title.trim()
    if (!title) throw new AppError('請填寫缺失標題')
    const { data, error } = await sb()
      .from('site_defects')
      .insert({
        organization_id: me.organizationId,
        site_id: requireUuid(input.siteId, '工地'),
        reported_by: me.id,
        title,
        detail: input.detail?.trim() || '',
        severity: input.severity ?? 'normal',
        status: 'open',
      })
      .select(
        'id, organization_id, site_id, reported_by, title, detail, severity, status, fixed_at, fixed_note, reinspected_at, reinspect_note, closed_at, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法新增缺失'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: String(data.site_id),
      reportedBy: String(data.reported_by),
      reporterName: me.name,
      title: String(data.title),
      detail: String(data.detail ?? ''),
      severity: data.severity as SiteDefect['severity'],
      status: data.status as SiteDefect['status'],
      createdAt: String(data.created_at),
    }
  },

  async advanceSiteDefect(
    actor: AppUser,
    input: { defectId: string; action: 'fix' | 'reinspect' | 'close'; note?: string },
  ): Promise<void> {
    const id = requireUuid(input.defectId, '缺失')
    const { data: current, error: loadError } = await sb()
      .from('site_defects')
      .select('id, organization_id, status, severity')
      .eq('id', id)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取缺失'))
    if (!current) throw new AppError('找不到缺失')
    assertSameOrganization(actor.organizationId, String(current.organization_id))

    const note = input.note?.trim() || ''
    const now = new Date().toISOString()
    let patch: Record<string, unknown> | null = null

    if (input.action === 'fix') {
      if (current.status !== 'open') throw new AppError('僅「待改善」可標記已改善')
      patch = {
        status: 'fixed',
        fixed_at: now,
        fixed_by: actor.id,
        fixed_note: note,
      }
    } else if (input.action === 'reinspect') {
      if (current.status !== 'fixed') throw new AppError('僅「已改善」可複驗')
      patch = {
        status: 'reinspected',
        reinspected_at: now,
        reinspected_by: actor.id,
        reinspect_note: note,
      }
    } else if (input.action === 'close') {
      if (current.status !== 'reinspected' && current.severity !== 'normal') {
        // safety must be reinspected before close
        throw new AppError('安全缺失須先完成複驗才能結案')
      }
      if (current.status === 'open') throw new AppError('請先完成改善')
      if (current.status === 'closed') throw new AppError('已結案')
      // normal: allow close from fixed or reinspected; safety: only reinspected (checked above for open)
      if (current.severity === 'safety' && current.status !== 'reinspected') {
        throw new AppError('安全缺失須先複驗再結案')
      }
      if (current.severity === 'normal' && !['fixed', 'reinspected'].includes(String(current.status))) {
        throw new AppError('請先標記改善')
      }
      patch = {
        status: 'closed',
        closed_at: now,
        closed_by: actor.id,
      }
    }

    if (!patch) throw new AppError('未知操作')
    const { error } = await sb().from('site_defects').update(patch).eq('id', id)
    if (error) throw new AppError(toUserMessage(error, '更新缺失失敗'))
  },

  /**
   * Claim an idempotent sync slot (INT-10).
   * Same client_operation_id + same hash → alreadyDone.
   * Same id + different hash → conflict.
   */
  async claimSyncOperation(input: {
    clientOperationId: string
    operationType: string
    requestHash: string
    payload: Record<string, unknown>
  }): Promise<{ alreadyDone: boolean; serverResourceId: string | null }> {
    const me = await this.getCurrentUser()
    if (!me) throw new AppError('尚未登入')
    const clientOperationId = input.clientOperationId.trim()
    if (!clientOperationId) throw new AppError('缺少操作識別碼')

    const { data: existing, error: loadError } = await sb()
      .from('sync_operations')
      .select(
        'id, client_operation_id, request_hash, status, server_resource_id',
      )
      .eq('user_id', me.id)
      .eq('client_operation_id', clientOperationId)
      .maybeSingle()
    if (loadError) {
      throw new AppError(toUserMessage(loadError, '無法讀取同步紀錄'))
    }
    if (existing) {
      if (String(existing.request_hash) !== input.requestHash) {
        throw new AppError('相同操作識別碼對應不同內容（IDEMPOTENCY_KEY_REUSED）')
      }
      // Only skip when a prior attempt already produced a server resource.
      if (existing.server_resource_id) {
        return {
          alreadyDone: true,
          serverResourceId: String(existing.server_resource_id),
        }
      }
      await sb()
        .from('sync_operations')
        .update({
          status: 'accepted',
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      return { alreadyDone: false, serverResourceId: null }
    }

    const { error: insertError } = await sb().from('sync_operations').insert({
      organization_id: me.organizationId,
      user_id: me.id,
      client_operation_id: clientOperationId,
      operation_type: input.operationType,
      request_hash: input.requestHash,
      status: 'accepted',
      payload: input.payload,
    })
    if (insertError) {
      // Race: another tab inserted — re-read
      if (String(insertError.code) === '23505') {
        const { data: raced } = await sb()
          .from('sync_operations')
          .select('request_hash, server_resource_id')
          .eq('user_id', me.id)
          .eq('client_operation_id', clientOperationId)
          .maybeSingle()
        if (raced && String(raced.request_hash) !== input.requestHash) {
          throw new AppError(
            '相同操作識別碼對應不同內容（IDEMPOTENCY_KEY_REUSED）',
          )
        }
        if (raced?.server_resource_id) {
          return {
            alreadyDone: true,
            serverResourceId: String(raced.server_resource_id),
          }
        }
        return { alreadyDone: false, serverResourceId: null }
      }
      throw new AppError(toUserMessage(insertError, '無法建立同步紀錄'))
    }

    return { alreadyDone: false, serverResourceId: null }
  },

  async completeSyncOperation(input: {
    clientOperationId: string
    serverResourceId: string | null
    status: 'accepted' | 'conflict' | 'failed'
    errorMessage?: string | null
  }): Promise<void> {
    const me = await this.getCurrentUser()
    if (!me) return
    const { error } = await sb()
      .from('sync_operations')
      .update({
        status: input.status,
        server_resource_id: input.serverResourceId,
        error_message: input.errorMessage ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', me.id)
      .eq('client_operation_id', input.clientOperationId)
    if (error) {
      console.warn('[sync] completeSyncOperation failed', error.message)
    }
  },
  async listDailyLogs(siteId: string): Promise<DailyLog[]> {
    const sid = requireUuid(siteId, '工地')
    const { data, error } = await sb()
      .from('daily_logs')
      .select(
        'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
      )
      .eq('site_id', sid)
      .order('log_date', { ascending: false })
      .limit(60)
    if (error) throw new AppError(toUserMessage(error, '無法載入施工日誌'))
    return (data ?? []).map((row) => mapDailyLog(row))
  },

  async listDailyLogVersions(dailyLogId: string): Promise<DailyLogVersion[]> {
    const id = requireUuid(dailyLogId, '日誌')
    const { data, error } = await sb()
      .from('daily_log_versions')
      .select('id, daily_log_id, version, body, summary, created_at, created_by')
      .eq('daily_log_id', id)
      .order('version', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入日誌版本'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      dailyLogId: String(row.daily_log_id),
      version: Number(row.version),
      body: String(row.body),
      summary: mapDailyLogSummary(row.summary),
      createdAt: String(row.created_at),
      createdBy: String(row.created_by),
    }))
  },

  /**
   * FIELD-006: assemble draft from reports / photos / defects / attendance for the site-day.
   * Refreshes draft body; if already published, reopens as draft for a new version cycle.
   */
  async ensureDailyLogDraft(
    actor: AppUser,
    siteId: string,
    logDate?: string,
  ): Promise<DailyLog> {
    const sid = requireUuid(siteId, '工地')
    const site = await this.getSite(sid, actor)
    if (!site) throw new AppError('找不到工地')

    const date = logDate || taipeiDateString()
    const dayStart = `${date}T00:00:00+08:00`
    const dayEnd = `${date}T23:59:59.999+08:00`

    const [{ data: reports }, { data: photos }, { data: defects }, { data: attendance }] =
      await Promise.all([
        sb()
          .from('construction_reports')
          .select('id, body, author_id, created_at')
          .eq('site_id', sid)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
        sb()
          .from('photo_uploads')
          .select('id, uploaded_by, created_at, status')
          .eq('site_id', sid)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
        sb()
          .from('site_defects')
          .select('id, title, status, severity, created_at')
          .eq('site_id', sid)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
        sb()
          .from('attendance')
          .select('id, user_id, clock_in_at, clock_out_at, status')
          .eq('site_id', sid)
          .gte('clock_in_at', dayStart)
          .lte('clock_in_at', dayEnd),
      ])

    const summary: DailyLogSummary = {
      reportCount: (reports ?? []).length,
      photoCount: (photos ?? []).length,
      defectCount: (defects ?? []).length,
      attendanceCount: (attendance ?? []).length,
    }

    const lines: string[] = [
      `【施工日誌草稿】${site.name} · ${date}`,
      '',
      `彙整：回報 ${summary.reportCount}、照片 ${summary.photoCount}、缺失 ${summary.defectCount}、出勤 ${summary.attendanceCount}`,
      '',
    ]

    if ((attendance ?? []).length) {
      lines.push('■ 出勤')
      for (const a of attendance ?? []) {
        const out = a.clock_out_at
          ? formatTaipei(String(a.clock_out_at), 'HH:mm')
          : '尚未下班'
        lines.push(
          `- ${formatTaipei(String(a.clock_in_at), 'HH:mm')}～${out}（${a.status}）`,
        )
      }
      lines.push('')
    }

    if ((reports ?? []).length) {
      lines.push('■ 施工回報')
      for (const r of reports ?? []) {
        const t = formatTaipei(String(r.created_at), 'HH:mm')
        lines.push(`- ${t} ${(r.body as string)?.trim() || '（僅照片／無文字）'}`)
      }
      lines.push('')
    }

    if ((photos ?? []).length) {
      lines.push(`■ 施工照片 ${summary.photoCount} 張（已歸檔／當日上傳）`)
      lines.push('')
    }

    if ((defects ?? []).length) {
      lines.push('■ 缺失')
      for (const d of defects ?? []) {
        lines.push(`- [${d.severity}/${d.status}] ${d.title}`)
      }
      lines.push('')
    }

    if (
      summary.reportCount +
        summary.photoCount +
        summary.defectCount +
        summary.attendanceCount ===
      0
    ) {
      lines.push('（當日尚無現場事件可彙整，可手動補寫後發布）')
    }

    const body = lines.join('\n').trim()

    const { data: existing } = await sb()
      .from('daily_logs')
      .select(
        'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
      )
      .eq('site_id', sid)
      .eq('log_date', date)
      .maybeSingle()

    if (existing) {
      const { data, error } = await sb()
        .from('daily_logs')
        .update({
          body,
          summary,
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select(
          'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
        )
        .single()
      if (error) throw new AppError(toUserMessage(error, '無法更新日誌草稿'))
      return mapDailyLog(data)
    }

    const { data, error } = await sb()
      .from('daily_logs')
      .insert({
        organization_id: actor.organizationId,
        site_id: sid,
        log_date: date,
        status: 'draft',
        body,
        summary,
        current_version: 0,
      })
      .select(
        'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立日誌草稿'))
    return mapDailyLog(data)
  },

  async updateDailyLogBody(actor: AppUser, logId: string, body: string): Promise<DailyLog> {
    const id = requireUuid(logId, '日誌')
    const { data: current, error: loadError } = await sb()
      .from('daily_logs')
      .select('id, organization_id, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取日誌'))
    if (!current) throw new AppError('找不到日誌')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    if (current.status !== 'draft') {
      throw new AppError('已發布日誌請先「重新彙整」再開草稿後編輯')
    }

    const { data, error } = await sb()
      .from('daily_logs')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法儲存日誌'))
    return mapDailyLog(data)
  },

  async publishDailyLog(actor: AppUser, logId: string): Promise<DailyLog> {
    const id = requireUuid(logId, '日誌')
    const { data: current, error: loadError } = await sb()
      .from('daily_logs')
      .select(
        'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
      )
      .eq('id', id)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取日誌'))
    if (!current) throw new AppError('找不到日誌')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    if (current.status !== 'draft') throw new AppError('僅草稿可發布')
    if (!String(current.body ?? '').trim()) throw new AppError('日誌內容不可空白')

    const nextVersion = Number(current.current_version ?? 0) + 1
    const { error: versionError } = await sb().from('daily_log_versions').insert({
      daily_log_id: id,
      organization_id: current.organization_id,
      version: nextVersion,
      body: current.body,
      summary: current.summary ?? {},
      created_by: actor.id,
    })
    if (versionError) {
      throw new AppError(toUserMessage(versionError, '無法寫入日誌版本'))
    }

    const { data, error } = await sb()
      .from('daily_logs')
      .update({
        status: 'published',
        current_version: nextVersion,
        published_at: new Date().toISOString(),
        published_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, organization_id, site_id, log_date, status, body, summary, current_version, published_at, updated_at, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '發布日誌失敗'))
    return mapDailyLog(data)
  },
}

function mapDailyLogSummary(raw: unknown): DailyLogSummary {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    reportCount: Number(s.reportCount ?? s.report_count ?? 0),
    photoCount: Number(s.photoCount ?? s.photo_count ?? 0),
    defectCount: Number(s.defectCount ?? s.defect_count ?? 0),
    attendanceCount: Number(s.attendanceCount ?? s.attendance_count ?? 0),
  }
}

function mapDailyLog(row: Record<string, unknown>): DailyLog {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    siteId: String(row.site_id),
    logDate: String(row.log_date),
    status: row.status as DailyLog['status'],
    body: String(row.body ?? ''),
    summary: mapDailyLogSummary(row.summary),
    currentVersion: Number(row.current_version ?? 0),
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
  }
}
