Warning: truncated output (original token count: 77517)
Total output lines: 8565

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
import { isBossLike, permissionRoleOf } from '@/domain/roleGroups'
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
  nextSiteReceiptSequence,
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
  SalaryPayment,
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

const CASH_RECEIPT_SELECT =
  'id, organization_id, site_id, site_name, location_text, quotation_id, received_on, site_sequence_no, amount, source_note, proof_photo_path, status, reported_by, reported_by_name, reported_at, confirmed_by, confirmed_at, confirm_note'

function mapCashReceiptRow(row: Record<string, unknown>): CashReceiptReport {
  const reportedAt = String(row.reported_at)
  const receivedRaw = (row.received_on as string | null) ?? null
  const receivedOn =
    receivedRaw && /^\d{4}-\d{2}-\d{2}/.test(receivedRaw)
      ? receivedRaw.slice(0, 10)
      : taipeiDateString(reportedAt)
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    siteId: row.site_id ? String(row.site_id) : null,
    siteName: String(row.site_name),
    locationText: (row.location_text as string | null) ?? null,
    quotationId: row.quotation_id ? String(row.quotation_id) : null,
    receivedOn,
    siteSequenceNo:
      row.site_sequence_no == null ? null : Number(row.site_sequence_no),
    amount: Number(row.amount),
    sourceNote: (row.source_note as string | null) ?? null,
    proofPhotoPath: (row.proof_photo_path as string | null) ?? null,
    status: row.status as CashReceiptReport['status'],
    reportedBy: String(row.reported_by),
    reportedByName: String(row.reported_by_name),
    reportedAt,
    confirmedBy: (row.confirmed_by as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    confirmNote: (row.confirm_note as string | null) ?? null,
  }
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

/** Soft-purged shells: keep for history FKs but never show in live member UIs. */
function isPurgedDirectoryMember(m: AppUser): boolean {
  if ((m.name ?? '').includes('（已刪除）')) return true
  if (m.accountStatus === 'disabled' && !m.loginId && !m.phone) return true
  return false
}

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

const SALARY_ENTRY_COLS =
  'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, source, attendance_date, day_fraction, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at'

const SALARY_ENTRY_COLS_LEGACY =
  'id, organization_id, user_id, user_name, period_year, period_month, entry_date, category, amount, title, note, site_id, site_name, status, created_by, confirmed_by, confirmed_at, paid_by, paid_at, cancelled_by, cancelled_at, cancel_reason, created_at, updated_at'

const SALARY_PAYMENT_COLS =
  'id, organization_id, employee_id, employee_name, settlement_year, settlement_month, amount, paid_on, note, created_by, created_at'

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
    source: (row.source as SalaryEntry['source']) ?? null,
    attendanceDate: row.attendance_date
      ? String(row.attendance_date).slice(0, 10)
      : null,
    dayFraction:
      row.day_fraction != null ? Number(row.day_fraction) : null,
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

function mapSalaryPayment(row: Record<string, unknown>): SalaryPayment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name),
    settlementYear: Number(row.settlement_year),
    settlementMonth: Number(row.settlement_month),
    amount: Number(row.amount),
    paidOn: String(row.paid_on).slice(0, 10),
    note: (row.note as string | null) ?? null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
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
   * Default password = account (phone or custom login id); must_change_password = true.
   */
  async createMemberAccount(
    actor: AppUser,
    input: { name: string; account: string; roleGroupName?: string | null },
  ): Promise<{ user: AppUser; message: string }> {
    assertFeature(actor, 'account')
    const { data, error } = await sb().functions.invoke('admin-create-member', {
      body: {
        name: input.name,
        account: input.account,
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
    if (!isBossLike(actor)) throw new AppError('僅老闆可設定工地權限')
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
    if (!self && !isBossLike(actor)) {
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
      if (existingHired && !isBossLike(actor)) {
        if (nextHired !== existingHired) {
          throw new AppError('到職日已鎖定，僅老闆可修改')
        }
      } else {
        payload.hired_at = nextHired
      }
    }
    if (input.accountStatus != null) {
      if (!isBossLike(actor)) throw new AppError('僅老闆可停用帳號')
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
    if (!isBossLike(actor)) assertFeature(actor, 'account')
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
      return (fallback.data ?? [])
        .map((row) => mapUser(row))
        .filter((m) => !isPurgedDirectoryMember(m))
    }
    if (full.error) throw new AppError(toUserMessage(full.error, '無法載入名冊'))
    return (full.data ?? [])
      .map((row) => mapUser(row))
      .filter((m) => !isPurgedDirectoryMember(m))
  },

  async deleteMemberAccount(
    actor: AppUser,
    input: { targetUserId: string; confirmName: string },
  ): Promise<{ message: string; mode: string }> {
    assertFeature(actor, 'account')
    const confirmName = input.confirmName.trim()
    if (!confirmName) throw new AppError('請填寫被刪除者姓名以確認')
    const { data, error } = await sb().functions.invoke('admin-delete-member', {
      body: {
        targetUserId: input.targetUserId,
        confirmName,
      },
    })
    const body = data as {
      error?: string
      message?: string
      mode?: string
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
      throw new AppError(toUserMessage(error, '無法刪除帳號'))
    }
    if (!body || body.error) {
      throw new AppError(body?.error || '無法刪除帳號')
    }
    return {
      message: body.message || '已刪除帳號',
      mode: body.mode || 'unknown',
    }
  },

  async listSites(actor?: AppUser): Promise<SiteProject[]> {
    if (actor) {
      assertPermission(permissionRoleOf(actor), PERMISSIONS.SITE_READ, {
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
    if (!actor || isBossLike(actor)) return sites
    const [allowed, orgHasAssignments] = await Promise.all([
      this.listAllowedSiteIds(actor.id),
      this.orgHasSiteAssignments(actor.organizationId),
    ])
    return filterSitesByAccess({
      role: actor.role,
      accessTemplate: actor.accessTemplate,
      sites,
      allowedSiteIds: allowed,
      orgHasAssignments,
    })
  },

  async getSite(id: string, actor?: AppUser): Promise<SiteProject | null> {
    // Invalid route ids must not hit Postgres or crash the page.
    if (!isUuid(id)) return null
    if (actor) {
      assertPermission(permissionRoleOf(actor), PERMISSIONS.SITE_READ, {
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
    if (actor && !isBossLike(actor)) {
      const [allowed, orgHasAssignments] = await Promise.all([
        this.listAllowedSiteIds(actor.id),
        this.orgHasSiteAssignments(actor.organizationId),
      ])
      assertCanAccessSite({
        role: actor.role,
        accessTemplate: actor.accessTemplate,
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
    assertPermission(permissionRoleOf(actor), PERMISSIONS.SITE_WRITE, {
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
    assertPermission(permissionRoleOf(actor), PERMISSIONS.SITE_WRITE, {
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
    const { error: expenseUnlinkError } = await sb()
      .from('expense_reports')
      .update({ site_id: null, site_name: label })
      .eq('site_id', sid)
    if (
      expenseUnlinkError &&
      !/column|relation|schema cache/i.test(expenseUnlinkError.message)
    ) {
      throw new AppError(
        toUserMessage(expenseUnlinkError, '無法解除支出與工地關聯'),
      )
    }
    const { error: receiptUnlinkError } = await sb()
      .from('cash_receipt_reports')
      .update({ site_id: null, site_name: label })
      .eq('site_id', sid)
    if (
      receiptUnlinkError &&
      !/column|relation|schema cache/i.test(receiptUnlinkError.message)
    ) {
      throw new AppError(
        toUserMessage(receiptUnlinkError, '無法解除收款與工地關聯'),
      )
    }

    const quotes = (await this.listQuotations()).filter(
      (q) => q.projectId === sid && !q.deletedAt,
    )
    for (const q of quotes) {
      await this.softDeleteQuotation(actor, q.id, '刪除工地案件')
    }
    // Always unlink — including quotes already soft-deleted earlier — or
    // quotations_project_id_fkey (ON DELETE RESTRICT) blocks site delete.
    const {…47517 tokens truncated…ceivedOn
        : null) || taipeiDateString()
    const { data, error } = await sb()
      .from('cash_receipt_reports')
      .insert({
        site_id: target.siteId,
        site_name: target.siteName,
        location_text: target.locationText,
        quotation_id: quotationId,
        received_on: receivedOn,
        amount: assertPositiveMoney(input.amount, '收款金額'),
        source_note: input.sourceNote?.trim() || null,
        proof_photo_path: input.proofPhotoPath?.trim() || null,
        status: 'pending_confirm',
        reported_by: actor.id,
        reported_by_name: actor.name,
      })
      .select(CASH_RECEIPT_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立收款'))
    const row = mapCashReceiptRow(data)
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
    // Boss needs all site rows to compute sequence (not only own reports).
    const { data: siteRows, error: listErr } = await sb()
      .from('cash_receipt_reports')
      .select(CASH_RECEIPT_SELECT)
      .order('reported_at', { ascending: false })
    if (listErr) throw new AppError(toUserMessage(listErr, '無法載入收款'))
    const all = (siteRows ?? []).map((row) => mapCashReceiptRow(row))
    const current = all.find((e) => e.id === id)
    if (!current) throw new AppError('找不到收款回報')
    assertBossFinalize({
      actorRole: permissionRoleOf(actor),
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
    const siteSequenceNo =
      status === 'confirmed' && current.siteId
        ? nextSiteReceiptSequence(all, current.siteId)
        : current.siteSequenceNo ?? null
    const { data, error } = await sb()
      .from('cash_receipt_reports')
      .update({
        status,
        site_sequence_no: siteSequenceNo,
        confirmed_by: actor.id,
        confirmed_at: new Date().toISOString(),
        confirm_note: input.note?.trim() || null,
      })
      .eq('id', id)
      .select(CASH_RECEIPT_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法確認收款'))
    const row = mapCashReceiptRow(data)
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
    if (input.decision === 'return' || input.decision === 'cancel') {
      const reason = input.note?.trim() || ''
      void safeNotify({
        recipientIds: [current.reportedBy],
        eventType:
          input.decision === 'return' ? 'receipt.returned' : 'receipt.cancelled',
        title:
          input.decision === 'return'
            ? `收款已退回修改：NT$${current.amount.toLocaleString()}`
            : `收款已取消（作廢）：NT$${current.amount.toLocaleString()}`,
        detail: `${current.siteName}${current.sourceNote ? ` · ${current.sourceNote}` : ''}${reason ? ` · ${reason}` : ''}`,
        href: '/expenses',
        asTodo: input.decision === 'return',
      })
    }
    return row
  },

  async linkCashReceiptQuote(
    actor: AppUser,
    input: { id: string; quotationId: string | null },
  ): Promise<CashReceiptReport> {
    if (!isBossLike(actor)) throw new AppError('僅老闆可關聯報價')
    const id = requireUuid(input.id, '收款')
    const current = (await this.listCashReceipts(actor)).find((e) => e.id === id)
    if (!current) throw new AppError('找不到收款回報')
    let quotationId: string | null = null
    if (input.quotationId?.trim()) {
      quotationId = requireUuid(input.quotationId, '報價')
      const quotes = await this.listQuotations()
      const q = quotes.find((x) => x.id === quotationId)
      if (!q || q.deletedAt) throw new AppError('找不到報價')
      if (current.siteId && q.projectId && q.projectId !== current.siteId) {
        throw new AppError('報價不屬於此工地')
      }
    }
    const { data, error } = await sb()
      .from('cash_receipt_reports')
      .update({ quotation_id: quotationId })
      .eq('id', id)
      .select(CASH_RECEIPT_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法關聯報價'))
    const row = mapCashReceiptRow(data)
    await this.appendAuditLog(actor, {
      action: 'receipt.link_quote',
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
    assertBossCancelFinance(permissionRoleOf(actor))
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
      .select(CASH_RECEIPT_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法刪除收款'))
    const row = mapCashReceiptRow(data)
    await this.appendAuditLog(actor, {
      action: 'receipt.cancel',
      targetType: 'cash_receipt',
      targetId: row.id,
      before: current,
      after: row,
    })
    void safeNotify({
      recipientIds: [current.reportedBy],
      eventType: 'receipt.cancelled',
      title: `收款已取消（作廢）：NT$${current.amount.toLocaleString()}`,
      detail: `${current.siteName}${current.sourceNote ? ` · ${current.sourceNote}` : ''} · ${note}`,
      href: '/expenses',
      asTodo: false,
    })
    return row
  },

  /** Permanently remove a cancelled receipt (boss only). */
  async purgeCashReceipt(
    actor: AppUser,
    input: { id: string },
  ): Promise<void> {
    assertBossCancelFinance(permissionRoleOf(actor))
    const id = requireUuid(input.id, '收款')
    const current = (await this.listCashReceipts(actor)).find((e) => e.id === id)
    if (!current) throw new AppError('找不到收款回報')
    if (current.status !== 'cancelled') {
      throw new AppError('僅已取消（作廢）的收款可永久刪除')
    }
    const { error } = await sb()
      .from('cash_receipt_reports')
      .delete()
      .eq('id', id)
    if (error) throw new AppError(toUserMessage(error, '無法永久刪除收款'))
    await this.appendAuditLog(actor, {
      action: 'receipt.cancel',
      targetType: 'cash_receipt',
      targetId: id,
      before: current,
      after: { purged: true },
      message: '永久刪除已作廢收款',
    })
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
    assertCanApprove(permissionRoleOf(actor))
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
    assertCanApprove(permissionRoleOf(actor))
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
    assertCanDisburse(permissionRoleOf(actor))
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
    assertPermission(permissionRoleOf(actor), PERMISSIONS.INVENTORY_INBOUND, {
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
