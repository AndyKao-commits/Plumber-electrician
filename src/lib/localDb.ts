import { assertCanApprovePurchase } from '@/domain/approvals'
import {
  assertEmergencyReserveAllowed,
  sumOccupiedQuota,
  type EmergencyLimitEvent,
} from '@/domain/emergencyLimits'
import { applyInboundMovingAverage } from '@/domain/inventoryCost'
import {
  assertCanExportQuote,
  assertCanMarkQuoteAccept,
} from '@/domain/permissions'
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
  assertCanMarkChangeOrderAccept,
  assertChangeOrderEditable,
  calcChangeOrderTotals,
  canCreateChangeOrder,
  effectiveContractAmountWithChangeOrders,
} from '@/domain/changeOrders'
import {
  assertCanSoftDeleteQuoteCase,
  assertCanSoftDeleteQuoteVersion,
} from '@/domain/quoteDelete'
import {
  assertQuoteAssociation,
  assertQuoteDraftEditable,
  calcFinalPayable,
  calcQuoteItemAmount,
} from '@/domain/rules'
import {
  buildQuoteExportSnapshot,
  calcQuoteTotals,
  legacyStatusFromWorkflow,
} from '@/domain/quoteWorkflow'
import type {
  AdvanceApplication,
  AppNotice,
  AppUser,
  AttendanceRecord,
  BillingDocument,
  BillingDocumentItem,
  BillingMilestone,
  ChangeOrder,
  ChangeOrderItem,
  ChangeOrderKind,
  ChangeOrderStatus,
  CaseOperatingCost,
  Customer,
  CustomerAdvance,
  CustomerContact,
  CustomerCreditNote,
  CustomerPayment,
  CustomerRefund,
  CustomerSiteLink,
  MaterialSerial,
  MaterialStock,
  MaterialUnit,
  MaterialUsage,
  OperatingCostKind,
  PettyCashAccount,
  PettyCashDisbursement,
  PettyCashLedgerEntry,
  PettyCashTopUpRequest,
  Supplier,
  SupplierExposure,
  StockBalance,
  ExpenseReport,
  CashReceiptReport,
  AuditLogEntry,
  StockLocation,
  StockMovement,
  StockReservation,
  PaymentAllocation,
  PaymentMethod,
  PurchaseRecord,
  Quotation,
  QuotationItem,
  QuotationItemKind,
  QuotationVersion,
  QuoteExportFormat,
  QuoteWorkflowStatus,
  RepairAssignment,
  RepairCase,
  RepairCaseStatus,
  RepairVisit,
  SiteProject,
  TaxMode,
  Complaint,
  ComplaintStatus,
  RelatedRepairCase,
  Warranty,
  WarrantyAssessment,
  WarrantyAssessmentClassification,
} from '@/domain/types'
import {
  assertComplaintSubject,
  assertDistinctRelatedCases,
  assertRelatedCasesAreAssociationOnly,
} from '@/domain/complaints'
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
  assertNoNegativeStock,
  assertUsageNotAlreadyPosted,
  assertUsageQty,
  computeUsageCost,
} from '@/domain/materialUsage'
import {
  assertAvailableForConsume,
  assertLedgerImmutable,
  assertNoNegativeOnHand,
  assertPositiveQty,
  assertReservationRelease,
  assertTransferDoesNotAffectCost,
  sumActiveReserved,
} from '@/domain/stockLedger'
import {
  assertSameOrganization as assertMaterialOrg,
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
  availableCredit,
  sumSupplierExposure,
} from '@/domain/suppliers'
import {
  assertBossFinalize,
  assertCanConfirmReceipt,
  assertCanReviewExpense,
  assertExpenseItem,
  assertPositiveMoney,
  computeCaseFinance,
} from '@/domain/fieldFinance'
import { buildAuditEntry, type AuditAction } from '@/domain/auditLog'
import {
  assertSpendSettingsInput,
  assertWithinDailyPurchaseLimit,
  defaultOrgSpendSettings,
  requiresBossReview,
  type OrgSpendSettings,
} from '@/domain/orgSpendSettings'
import { filterSitesByAccess } from '@/domain/siteAccess'
import {
  assertAccountStatus,
  normalizeProfileFields,
} from '@/domain/profileFields'
import { roundMoney } from '@/domain/money'
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
  repairCases: 'eg.repairCases.v2',
  repairAssignments: 'eg.repairAssignments.v1',
  repairVisits: 'eg.repairVisits.v1',
  warranties: 'eg.warranties.v1',
  warrantyAssessments: 'eg.warrantyAssessments.v1',
  complaints: 'eg.complaints.v1',
  relatedRepairCases: 'eg.relatedRepairCases.v1',
  quotations: 'eg.quotations.v2',
  quotationItems: 'eg.quotationItems.v1',
  quotationVersions: 'eg.quotationVersions.v1',
  changeOrders: 'eg.changeOrders.v1',
  changeOrderItems: 'eg.changeOrderItems.v1',
  billingMilestones: 'eg.billingMilestones.v1',
  billingDocuments: 'eg.billingDocuments.v1',
  billingDocumentItems: 'eg.billingDocumentItems.v1',
  customerPayments: 'eg.customerPayments.v1',
  paymentAllocations: 'eg.paymentAllocations.v1',
  customerAdvances: 'eg.customerAdvances.v1',
  advanceApplications: 'eg.advanceApplications.v1',
  customerCreditNotes: 'eg.customerCreditNotes.v1',
  customerRefunds: 'eg.customerRefunds.v1',
  caseOperatingCosts: 'eg.caseOperatingCosts.v1',
  customers: 'eg.customers.v1',
  customerContacts: 'eg.customerContacts.v1',
  customerSiteLinks: 'eg.customerSiteLinks.v1',
  materials: 'eg.materials.v1',
  materialUsages: 'eg.materialUsages.v1',
  materialUnits: 'eg.materialUnits.v1',
  materialSerials: 'eg.materialSerials.v1',
  stockLocations: 'eg.stockLocations.v1',
  stockBalances: 'eg.stockBalances.v1',
  stockMovements: 'eg.stockMovements.v1',
  stockReservations: 'eg.stockReservations.v1',
  pettyCashAccounts: 'eg.pettyCashAccounts.v1',
  pettyCashRequests: 'eg.pettyCashRequests.v1',
  pettyCashDisbursements: 'eg.pettyCashDisbursements.v1',
  pettyCashLedger: 'eg.pettyCashLedger.v1',
  suppliers: 'eg.suppliers.v1',
  expenseReports: 'eg.expenseReports.v1',
  cashReceipts: 'eg.cashReceipts.v1',
  auditLogs: 'eg.auditLogs.v1',
  orgSpendSettings: 'eg.orgSpendSettings.v1',
  siteMembers: 'eg.siteMembers.v1',
} as const

type SiteMemberRow = {
  siteId: string
  userId: string
  createdAt: string
}

const emptySiteMembers: SiteMemberRow[] = []

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
const emptyRepairAssignments: RepairAssignment[] = []
const emptyRepairVisits: RepairVisit[] = []
const emptyWarranties: Warranty[] = []
const emptyWarrantyAssessments: WarrantyAssessment[] = []
const emptyComplaints: Complaint[] = []
const emptyRelatedRepairCases: RelatedRepairCase[] = []
const emptyQuotes: Quotation[] = []
const emptyQuoteItems: QuotationItem[] = []
const emptyQuoteVersions: QuotationVersion[] = []
const emptyChangeOrders: ChangeOrder[] = []
const emptyChangeOrderItems: ChangeOrderItem[] = []
const emptyBillingMilestones: BillingMilestone[] = []
const emptyBillingDocuments: BillingDocument[] = []
const emptyBillingDocumentItems: BillingDocumentItem[] = []
const emptyCustomerPayments: CustomerPayment[] = []
const emptyPaymentAllocations: PaymentAllocation[] = []
const emptyCustomerAdvances: CustomerAdvance[] = []
const emptyAdvanceApplications: AdvanceApplication[] = []
const emptyCustomerCreditNotes: CustomerCreditNote[] = []
const emptyCustomerRefunds: CustomerRefund[] = []
const emptyCaseOperatingCosts: CaseOperatingCost[] = []
const emptyCustomers: Customer[] = []
const emptyCustomerContacts: CustomerContact[] = []
const emptyCustomerSiteLinks: CustomerSiteLink[] = []
const emptyMaterials: MaterialStock[] = []
const emptyMaterialUsages: MaterialUsage[] = []
const emptyMaterialUnits: MaterialUnit[] = []
const emptyMaterialSerials: MaterialSerial[] = []
const emptyStockLocations: StockLocation[] = []
const emptyStockBalances: StockBalance[] = []
const emptyStockMovements: StockMovement[] = []
const emptyStockReservations: StockReservation[] = []
const emptyPettyCashAccounts: PettyCashAccount[] = []
const emptyPettyCashRequests: PettyCashTopUpRequest[] = []
const emptyPettyCashDisbursements: PettyCashDisbursement[] = []
const emptyPettyCashLedger: PettyCashLedgerEntry[] = []
const emptySuppliers: Supplier[] = []
const emptyExpenseReports: ExpenseReport[] = []
const emptyCashReceipts: CashReceiptReport[] = []
const emptyAuditLogs: AuditLogEntry[] = []

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function normalizeLocalRepair(r: RepairCase & { title?: string }): RepairCase {
  const problemDescription =
    r.problemDescription?.trim() || r.title?.trim() || '（未填問題）'
  return {
    ...r,
    caseNumber: r.caseNumber || `RC-${r.id.slice(-6)}`,
    problemDescription,
    title: r.title?.trim() || problemDescription,
    status: r.status || 'pending_schedule',
    customerName: r.customerName ?? null,
    customerId: r.customerId ?? null,
    siteId: r.siteId ?? null,
    updatedAt: r.updatedAt || r.createdAt,
  }
}

function normalizeLocalQuote(q: Quotation): Quotation {
  const workflowStatus =
    q.workflowStatus ||
    (q.status === 'published'
      ? 'exported'
      : q.status === 'void'
        ? 'cancelled'
        : 'editing')
  return {
    ...q,
    workflowStatus,
    quoteNumber: q.quoteNumber || `Q-${q.id.slice(-8).toUpperCase()}`,
    customerName: q.customerName || '',
    siteAddress: q.siteAddress || '',
    discount: Number(q.discount ?? 0) || 0,
    currentVersion: Number(q.currentVersion ?? 0) || 0,
    updatedAt: q.updatedAt || q.createdAt,
    paymentTerms: q.paymentTerms ?? '依約定',
  }
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
      nickname: '老闆',
      jobTitle: '負責人',
      accountStatus: 'active',
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
      nickname: '阿明',
      jobTitle: '水電',
      hiredAt: '2024-01-15',
      accountStatus: 'active',
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
      nickname: '阿強',
      jobTitle: '水電',
      hiredAt: '2024-06-01',
      accountStatus: 'active',
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
      caseNumber: 'RC-SEED-0001',
      problemDescription: '廚房水管漏水',
      title: '廚房水管漏水',
      status: 'pending_schedule',
      siteId: 'site-b',
      customerName: '陳小姐',
      createdAt: now,
      updatedAt: now,
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
      sku: 'PVC-4',
      trackingMode: 'quantity',
      baseUnitCode: '支',
      updatedAt: now,
    },
    {
      id: 'mat-wire',
      organizationId: ORG_ID,
      name: '電線 2.0mm',
      unit: '米',
      qty: 100,
      unitCost: 12.5,
      sku: 'WIRE-20',
      trackingMode: 'quantity',
      baseUnitCode: '米',
      updatedAt: now,
    },
    {
      id: 'mat-pump',
      organizationId: ORG_ID,
      name: '加壓馬達',
      unit: '台',
      qty: 1,
      unitCost: 8500,
      sku: 'PUMP-BOOST',
      trackingMode: 'serial',
      baseUnitCode: '台',
      updatedAt: now,
    },
  ]

  const seededPurchases: PurchaseRecord[] = [
    {
      id: 'pur-seed-pending',
      organizationId: ORG_ID,
      userId: 'user-worker',
      siteId: 'site-a',
      supplierId: 'sup-seed-a',
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
    {
      id: 'pur-seed-approved',
      organizationId: ORG_ID,
      userId: 'user-boss',
      siteId: 'site-a',
      supplierId: 'sup-seed-a',
      mode: 'normal',
      status: 'approved',
      title: '電線批發（已核准未收貨）',
      goodsAmount: 4000,
      discount: 0,
      tax: 0,
      shipping: 0,
      otherBuyerFees: 0,
      finalPayable: 4000,
      createdAt: now,
      businessDate: formatTaipei(now, 'yyyy-MM-dd'),
      approvedBy: 'user-boss',
      approvedAt: now,
    },
  ]

  write(KEYS.users, seededUsers)
  write(KEYS.sites, seededSites)
  write(KEYS.attendance, emptyAttendance)
  write(KEYS.purchases, seededPurchases)
  write(KEYS.notices, seededNotices)
  write(KEYS.emergencyEvents, emptyEvents)
  write(KEYS.repairCases, seededRepairs)
  write(KEYS.repairAssignments, emptyRepairAssignments)
  write(KEYS.repairVisits, emptyRepairVisits)
  write(KEYS.warranties, emptyWarranties)
  write(KEYS.warrantyAssessments, emptyWarrantyAssessments)
  write(KEYS.complaints, emptyComplaints)
  write(KEYS.relatedRepairCases, emptyRelatedRepairCases)
  write(KEYS.quotations, emptyQuotes)
  write(KEYS.quotationItems, emptyQuoteItems)
  write(KEYS.quotationVersions, emptyQuoteVersions)
  write(KEYS.changeOrders, emptyChangeOrders)
  write(KEYS.changeOrderItems, emptyChangeOrderItems)
  write(KEYS.billingMilestones, emptyBillingMilestones)
  write(KEYS.billingDocuments, emptyBillingDocuments)
  write(KEYS.billingDocumentItems, emptyBillingDocumentItems)
  write(KEYS.customerPayments, emptyCustomerPayments)
  write(KEYS.paymentAllocations, emptyPaymentAllocations)
  write(KEYS.customerAdvances, emptyCustomerAdvances)
  write(KEYS.advanceApplications, emptyAdvanceApplications)
  write(KEYS.customerCreditNotes, emptyCustomerCreditNotes)
  write(KEYS.customerRefunds, emptyCustomerRefunds)
  write(KEYS.caseOperatingCosts, emptyCaseOperatingCosts)
  write(KEYS.customers, emptyCustomers)
  write(KEYS.customerContacts, emptyCustomerContacts)
  write(KEYS.customerSiteLinks, emptyCustomerSiteLinks)
  write(KEYS.materials, seededMaterials)
  write(KEYS.materialUsages, emptyMaterialUsages)
  write(KEYS.materialUnits, [
    {
      id: 'mu-pipe-base',
      organizationId: ORG_ID,
      materialId: 'mat-pipe',
      code: '支',
      label: '支',
      factorToBase: 1,
      isBase: true,
    },
    {
      id: 'mu-pipe-box',
      organizationId: ORG_ID,
      materialId: 'mat-pipe',
      code: '箱',
      label: '箱（20 支）',
      factorToBase: 20,
      isBase: false,
    },
    {
      id: 'mu-wire-base',
      organizationId: ORG_ID,
      materialId: 'mat-wire',
      code: '米',
      label: '米',
      factorToBase: 1,
      isBase: true,
    },
    {
      id: 'mu-wire-roll',
      organizationId: ORG_ID,
      materialId: 'mat-wire',
      code: '捲',
      label: '捲（100 米）',
      factorToBase: 100,
      isBase: false,
    },
    {
      id: 'mu-pump-base',
      organizationId: ORG_ID,
      materialId: 'mat-pump',
      code: '台',
      label: '台',
      factorToBase: 1,
      isBase: true,
    },
  ])
  write(KEYS.materialSerials, [
    {
      id: 'ms-pump-1',
      organizationId: ORG_ID,
      materialId: 'mat-pump',
      serialNumber: 'PUMP-SEED-001',
      status: 'in_stock',
      unitCost: 8500,
      locationId: 'loc-warehouse',
      createdAt: now,
      createdBy: 'user-boss',
    },
  ])
  const defaultWh: StockLocation = {
    id: 'loc-warehouse',
    organizationId: ORG_ID,
    kind: 'warehouse',
    name: '總倉',
    siteId: null,
    isDefault: true,
    createdAt: now,
  }
  const siteLoc: StockLocation = {
    id: 'loc-site-a',
    organizationId: ORG_ID,
    kind: 'site',
    name: '工地庫 · 示範工程 A',
    siteId: 'site-a',
    isDefault: false,
    createdAt: now,
  }
  write(KEYS.stockLocations, [defaultWh, siteLoc])
  write(KEYS.stockBalances, [
    {
      id: 'bal-pipe-wh',
      organizationId: ORG_ID,
      materialId: 'mat-pipe',
      locationId: defaultWh.id,
      qty: 20,
      updatedAt: now,
    },
    {
      id: 'bal-wire-wh',
      organizationId: ORG_ID,
      materialId: 'mat-wire',
      locationId: defaultWh.id,
      qty: 100,
      updatedAt: now,
    },
    {
      id: 'bal-pump-wh',
      organizationId: ORG_ID,
      materialId: 'mat-pump',
      locationId: defaultWh.id,
      qty: 1,
      updatedAt: now,
    },
  ])
  write(KEYS.stockMovements, emptyStockMovements)
  write(KEYS.stockReservations, emptyStockReservations)
  write(KEYS.pettyCashAccounts, [
    {
      id: 'pca-worker',
      organizationId: ORG_ID,
      custodianUserId: 'user-worker',
      label: '員工零用金（示範）',
      balance: 2000,
      updatedAt: now,
    },
  ])
  write(KEYS.pettyCashRequests, emptyPettyCashRequests)
  write(KEYS.pettyCashDisbursements, emptyPettyCashDisbursements)
  write(KEYS.pettyCashLedger, emptyPettyCashLedger)
  write(KEYS.suppliers, [
    {
      id: 'sup-seed-a',
      organizationId: ORG_ID,
      name: '大正水電材料行',
      creditLimit: 50000,
      paymentTermsDays: 30,
      notes: '月結示範供應商',
      createdAt: now,
      updatedAt: now,
    },
  ])
  write(KEYS.expenseReports, emptyExpenseReports)
  write(KEYS.cashReceipts, emptyCashReceipts)
  write(KEYS.auditLogs, emptyAuditLogs)
  write(KEYS.orgSpendSettings, defaultOrgSpendSettings(ORG_ID))
  write(KEYS.siteMembers, [
    {
      siteId: 'site-a',
      userId: 'user-worker',
      createdAt: now,
    },
    {
      siteId: 'site-b',
      userId: 'user-worker',
      createdAt: now,
    },
    {
      siteId: 'site-a',
      userId: 'user-worker-2',
      createdAt: now,
    },
  ] satisfies SiteMemberRow[])
  write(KEYS.shortcuts, [
    'sites',
    'cash',
    'clock',
    'photos',
    'quotes',
    'todos',
    'team',
    'audit',
    'settings',
    'profile',
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

  getSites(actor?: { id: string; role: AppUser['role'] } | null): SiteProject[] {
    const all = read(KEYS.sites, emptySites).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
    if (!actor) return all
    return filterSitesByAccess({
      role: actor.role,
      sites: all,
      allowedSiteIds: this.listAllowedSiteIds(actor.id),
    })
  },

  listAllowedSiteIds(userId: string): string[] {
    return read(KEYS.siteMembers, emptySiteMembers)
      .filter((m) => m.userId === userId)
      .map((m) => m.siteId)
  },

  listSiteMembers(siteId: string): string[] {
    return read(KEYS.siteMembers, emptySiteMembers)
      .filter((m) => m.siteId === siteId)
      .map((m) => m.userId)
  },

  setSiteMembers(
    actor: { id: string; role: AppUser['role'] },
    siteId: string,
    userIds: string[],
  ): void {
    if (actor.role !== 'boss') throw new Error('僅老闆可設定工地權限')
    if (!read(KEYS.sites, emptySites).some((s) => s.id === siteId)) {
      throw new Error('找不到工地')
    }
    const now = new Date().toISOString()
    const others = read(KEYS.siteMembers, emptySiteMembers).filter(
      (m) => m.siteId !== siteId,
    )
    const next: SiteMemberRow[] = [
      ...others,
      ...userIds.map((userId) => ({ siteId, userId, createdAt: now })),
    ]
    write(KEYS.siteMembers, next)
  },

  updateProfile(
    actor: { id: string; role: AppUser['role'] },
    targetUserId: string,
    input: {
      nickname?: string | null
      birthDate?: string | null
      jobTitle?: string | null
      hiredAt?: string | null
      notes?: string | null
      accountStatus?: string | null
    },
  ): AppUser {
    const users = this.getUsers()
    const idx = users.findIndex((u) => u.id === targetUserId)
    if (idx < 0) throw new Error('找不到使用者')
    const self = actor.id === targetUserId
    if (!self && actor.role !== 'boss') {
      throw new Error('僅本人或老闆可更新資料')
    }
    const fields = normalizeProfileFields(input)
    let nextStatus = users[idx].accountStatus ?? 'active'
    if (input.accountStatus != null) {
      if (actor.role !== 'boss') throw new Error('僅老闆可停用帳號')
      nextStatus = assertAccountStatus(input.accountStatus)
    }
    const updated: AppUser = {
      ...users[idx],
      ...fields,
      accountStatus: nextStatus,
    }
    users[idx] = updated
    write(KEYS.users, users)
    return updated
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

  listSuppliers(): Supplier[] {
    return read(KEYS.suppliers, emptySuppliers).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  },

  createSupplier(input: {
    name: string
    creditLimit?: number | null
    paymentTermsDays?: number
    notes?: string | null
  }): Supplier {
    const now = new Date().toISOString()
    const row: Supplier = {
      id: `sup-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      name: assertSupplierName(input.name),
      creditLimit:
        input.creditLimit == null || Number(input.creditLimit) <= 0
          ? null
          : roundMoney(Number(input.creditLimit)),
      paymentTermsDays: Math.max(0, Number(input.paymentTermsDays) || 30),
      notes: input.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }
    const all = this.listSuppliers()
    all.push(row)
    write(KEYS.suppliers, all)
    return row
  },

  getSupplierExposure(supplierId: string): SupplierExposure {
    const purchases = this.getPurchases().filter(
      (p) => p.supplierId === supplierId,
    )
    const sums = sumSupplierExposure(purchases)
    const supplier = this.listSuppliers().find((s) => s.id === supplierId)
    return {
      supplierId,
      ...sums,
      availableCredit: availableCredit({
        creditLimit: supplier?.creditLimit,
        exposure: sums.exposure,
      }),
    }
  },

  linkPurchaseSupplier(input: {
    purchaseId: string
    supplierId: string
  }): PurchaseRecord {
    const purchase = this.getPurchases().find((p) => p.id === input.purchaseId)
    if (!purchase) throw new Error('找不到採購')
    const supplier = this.listSuppliers().find((s) => s.id === input.supplierId)
    if (!supplier) throw new Error('找不到供應商')
    const exposure = this.getSupplierExposure(supplier.id)
    // If already linked to this supplier, don't re-add amount.
    const nextAmount =
      purchase.supplierId === supplier.id ? 0 : purchase.finalPayable
    assertWithinCreditLimit({
      creditLimit: supplier.creditLimit,
      exposure: exposure.exposure,
      nextAmount,
    })
    const updated = { ...purchase, supplierId: supplier.id }
    this.savePurchase(updated)
    return updated
  },

  markPurchasePaid(purchaseId: string): PurchaseRecord {
    const purchase = this.getPurchases().find((p) => p.id === purchaseId)
    if (!purchase) throw new Error('找不到採購')
    if (!purchase.inboundAt) {
      throw new Error('僅已收貨應付可標記付款')
    }
    if (purchase.paidAt) throw new Error('此採購已標記付款')
    const updated = { ...purchase, paidAt: new Date().toISOString() }
    this.savePurchase(updated)
    return updated
  },

  createPurchase(input: {
    userId: string
    title: string
    mode: PurchaseRecord['mode']
    siteId?: string
    supplierId?: string | null
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
    const settings = this.getOrgSpendSettings()
    const needsApproval =
      input.mode === 'normal' &&
      requiresBossReview(finalPayable, settings.reportReviewThresholdNtd)

    const usedToday = this.getPurchases()
      .filter(
        (p) =>
          p.userId === input.userId &&
          p.businessDate === businessDate &&
          p.status !== 'rejected' &&
          p.status !== 'cancelled',
      )
      .reduce((s, p) => s + p.finalPayable, 0)
    assertWithinDailyPurchaseLimit({
      usedTodayNtd: usedToday,
      nextAmount: finalPayable,
      dailyPurchaseLimitNtd: settings.dailyPurchaseLimitNtd,
    })

    if (input.mode === 'emergency') {
      const dayEvents = this.emergencyEventsForDay(input.userId, businessDate)
      assertEmergencyReserveAllowed({
        eventsForDay: dayEvents,
        reserveAmount: finalPayable,
        singleLimit: settings.emergencySingleLimitNtd,
        dailyLimit: settings.emergencyDailyLimitNtd,
      })
    }

    if (input.supplierId) {
      const supplier = this.listSuppliers().find((s) => s.id === input.supplierId)
      if (!supplier) throw new Error('找不到供應商')
      const exposure = this.getSupplierExposure(supplier.id)
      assertWithinCreditLimit({
        creditLimit: supplier.creditLimit,
        exposure: exposure.exposure,
        nextAmount: finalPayable,
      })
    }

    const record: PurchaseRecord = {
      id: `pur-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      userId: input.userId,
      siteId: input.siteId ?? null,
      supplierId: input.supplierId ?? null,
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
      .map(normalizeLocalRepair)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  getRepairCase(id: string): RepairCase | null {
    return this.getRepairCases().find((r) => r.id === id) ?? null
  },

  createRepairCase(
    actor: { id: string; name?: string },
    input: {
      problemDescription: string
      customerName?: string | null
      customerId?: string | null
      siteId?: string | null
    },
  ): RepairCase {
    const problemDescription = assertProblemDescription(
      input.problemDescription,
    )
    const now = new Date().toISOString()
    const id = `repair-${crypto.randomUUID()}`
    const row: RepairCase = {
      id,
      organizationId: ORG_ID,
      caseNumber: `RC-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      problemDescription,
      title: problemDescription,
      status: 'pending_schedule',
      siteId: input.siteId || null,
      customerId: input.customerId || null,
      customerName: input.customerName?.trim() || null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.repairCases, emptyRepairs)
    all.unshift(row)
    write(KEYS.repairCases, all)
    return row
  },

  setRepairCaseStatus(
    _actor: { id: string },
    repairCaseId: string,
    status: RepairCaseStatus,
  ): RepairCase {
    const all = read(KEYS.repairCases, emptyRepairs).map(normalizeLocalRepair)
    const idx = all.findIndex((r) => r.id === repairCaseId)
    if (idx < 0) throw new Error('找不到維修案件')
    all[idx] = {
      ...all[idx],
      status,
      updatedAt: new Date().toISOString(),
    }
    write(KEYS.repairCases, all)
    return all[idx]
  },

  listRepairAssignments(repairCaseId: string): RepairAssignment[] {
    return read(KEYS.repairAssignments, emptyRepairAssignments)
      .filter((a) => a.repairCaseId === repairCaseId)
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
  },

  assignRepair(
    actor: { id: string; name: string },
    input: {
      repairCaseId: string
      assigneeUserId: string
      assigneeName: string
      note?: string | null
    },
  ): RepairAssignment {
    const repair = this.getRepairCase(input.repairCaseId)
    if (!repair) throw new Error('找不到維修案件')
    const now = new Date().toISOString()
    const row: RepairAssignment = {
      id: `ra-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      repairCaseId: repair.id,
      assigneeUserId: input.assigneeUserId,
      assigneeName: input.assigneeName.trim() || '未命名',
      note: input.note?.trim() || null,
      assignedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.repairAssignments, emptyRepairAssignments)
    all.unshift(row)
    write(KEYS.repairAssignments, all)
    const next = nextRepairStatusAfterDispatch(repair.status)
    if (next !== repair.status) {
      this.setRepairCaseStatus(actor, repair.id, next)
    }
    return row
  },

  listRepairVisits(repairCaseId: string): RepairVisit[] {
    return read(KEYS.repairVisits, emptyRepairVisits)
      .filter((v) => v.repairCaseId === repairCaseId)
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
  },

  recordRepairVisit(
    actor: { id: string; name: string },
    input: {
      repairCaseId: string
      note?: string | null
      visitedAt?: string
    },
  ): RepairVisit {
    const repair = this.getRepairCase(input.repairCaseId)
    if (!repair) throw new Error('找不到維修案件')
    // REP-03: explicitly do not create attendance
    if (visitCreatesAttendance()) {
      throw new Error('內部錯誤：到場不得建立出勤')
    }
    const now = input.visitedAt || new Date().toISOString()
    const row: RepairVisit = {
      id: `rv-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      repairCaseId: repair.id,
      visitorUserId: actor.id,
      visitorName: actor.name,
      note: input.note?.trim() || null,
      visitedAt: now,
      createdBy: actor.id,
      attendanceCreated: false,
    }
    const all = read(KEYS.repairVisits, emptyRepairVisits)
    all.unshift(row)
    write(KEYS.repairVisits, all)
    const next = nextRepairStatusAfterVisit(repair.status)
    if (next !== repair.status) {
      this.setRepairCaseStatus(actor, repair.id, next)
    }
    return row
  },

  listWarranties(): Warranty[] {
    return read(KEYS.warranties, emptyWarranties).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )
  },

  createWarranty(
    actor: { id: string },
    input: {
      title: string
      siteId?: string | null
      repairCaseId?: string | null
      startsOn?: string | null
      endsOn?: string | null
      scopeNotes?: string | null
      exclusionNotes?: string | null
    },
  ): Warranty {
    const title = input.title.trim()
    if (!title) throw new Error('保固標題為必填')
    const now = new Date().toISOString()
    const row: Warranty = {
      id: `war-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      title,
      siteId: input.siteId || null,
      repairCaseId: input.repairCaseId || null,
      startsOn: input.startsOn || null,
      endsOn: input.endsOn || null,
      scopeNotes: input.scopeNotes?.trim() || null,
      exclusionNotes: input.exclusionNotes?.trim() || null,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.warranties, emptyWarranties)
    all.unshift(row)
    write(KEYS.warranties, all)
    return row
  },

  listWarrantyAssessments(repairCaseId: string): WarrantyAssessment[] {
    return read(KEYS.warrantyAssessments, emptyWarrantyAssessments)
      .filter((a) => a.repairCaseId === repairCaseId)
      .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))
  },

  createWarrantyAssessment(
    actor: { id: string; name: string },
    input: {
      repairCaseId: string
      warrantyId?: string | null
      classification: WarrantyAssessmentClassification
      rationale: string
    },
  ): WarrantyAssessment {
    if (!this.getRepairCase(input.repairCaseId)) throw new Error('找不到維修案件')
    const warranty = input.warrantyId
      ? this.listWarranties().find((w) => w.id === input.warrantyId)
      : null
    // Explicitly refuse calendar auto-free (REP-04)
    if (
      isAutoFreeByWarrantyDates({
        now: new Date().toISOString(),
        warrantyStart: warranty?.startsOn,
        warrantyEnd: warranty?.endsOn,
      })
    ) {
      throw new Error('不可依保固日期自動免費')
    }
    const rationale = assertWarrantyAssessmentRationale(input.rationale)
    const now = new Date().toISOString()
    const row: WarrantyAssessment = {
      id: `wa-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      repairCaseId: input.repairCaseId,
      warrantyId: input.warrantyId || null,
      classification: input.classification,
      rationale,
      assessedAt: now,
      assessedBy: actor.id,
      assessedByName: actor.name,
    }
    const all = read(KEYS.warrantyAssessments, emptyWarrantyAssessments)
    all.unshift(row)
    write(KEYS.warrantyAssessments, all)
    return row
  },

  listComplaints(): Complaint[] {
    return read(KEYS.complaints, emptyComplaints).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )
  },

  createComplaint(
    actor: { id: string },
    input: {
      subject: string
      detail?: string | null
      siteId?: string | null
      repairCaseId?: string | null
      customerName?: string | null
    },
  ): Complaint {
    const subject = assertComplaintSubject(input.subject)
    const now = new Date().toISOString()
    const row: Complaint = {
      id: `cmp-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      subject,
      detail: input.detail?.trim() || null,
      status: 'open',
      siteId: input.siteId || null,
      repairCaseId: input.repairCaseId || null,
      customerName: input.customerName?.trim() || null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.complaints, emptyComplaints)
    all.unshift(row)
    write(KEYS.complaints, all)
    return row
  },

  setComplaintStatus(
    _actor: { id: string },
    complaintId: string,
    status: ComplaintStatus,
  ): Complaint {
    const all = read(KEYS.complaints, emptyComplaints)
    const idx = all.findIndex((c) => c.id === complaintId)
    if (idx < 0) throw new Error('找不到客訴')
    all[idx] = {
      ...all[idx],
      status,
      updatedAt: new Date().toISOString(),
    }
    write(KEYS.complaints, all)
    return all[idx]
  },

  listRelatedRepairCases(repairCaseId: string): RelatedRepairCase[] {
    return read(KEYS.relatedRepairCases, emptyRelatedRepairCases).filter(
      (r) =>
        r.fromRepairCaseId === repairCaseId ||
        r.toRepairCaseId === repairCaseId,
    )
  },

  linkRelatedRepairCases(
    actor: { id: string },
    input: {
      fromRepairCaseId: string
      toRepairCaseId: string
      note?: string | null
    },
  ): RelatedRepairCase {
    assertDistinctRelatedCases(input.fromRepairCaseId, input.toRepairCaseId)
    const policy = assertRelatedCasesAreAssociationOnly(input)
    if (policy.mergesCases || policy.deletesCases) {
      throw new Error('禁止合併或刪除原始維修案件')
    }
    if (!this.getRepairCase(input.fromRepairCaseId)) {
      throw new Error('找不到來源維修案件')
    }
    if (!this.getRepairCase(input.toRepairCaseId)) {
      throw new Error('找不到目標維修案件')
    }
    // Do not delete or merge either case
    const before = this.getRepairCases().length
    const now = new Date().toISOString()
    const row: RelatedRepairCase = {
      id: `rrc-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      fromRepairCaseId: input.fromRepairCaseId,
      toRepairCaseId: input.toRepairCaseId,
      note: input.note?.trim() || null,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.relatedRepairCases, emptyRelatedRepairCases)
    if (
      all.some(
        (r) =>
          r.fromRepairCaseId === row.fromRepairCaseId &&
          r.toRepairCaseId === row.toRepairCaseId,
      )
    ) {
      throw new Error('案件已關聯')
    }
    all.push(row)
    write(KEYS.relatedRepairCases, all)
    if (this.getRepairCases().length !== before) {
      throw new Error('關聯不得改變案件數量')
    }
    return row
  },

  listCustomers(): Customer[] {
    return read(KEYS.customers, emptyCustomers).sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-Hant'),
    )
  },

  getCustomer(customerId: string): Customer | null {
    return this.listCustomers().find((c) => c.id === customerId) ?? null
  },

  createCustomer(
    actor: { id: string },
    input: { name: string; phone?: string | null; notes?: string | null },
  ): Customer {
    const name = assertCustomerName(input.name)
    const now = new Date().toISOString()
    const row: Customer = {
      id: `cust-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      name,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.customers, emptyCustomers)
    all.unshift(row)
    write(KEYS.customers, all)
    return row
  },

  listCustomerContacts(customerId: string): CustomerContact[] {
    return read(KEYS.customerContacts, emptyCustomerContacts)
      .filter((c) => c.customerId === customerId)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  },

  addCustomerContact(
    _actor: { id: string },
    input: {
      customerId: string
      name: string
      phone?: string | null
      email?: string | null
      isPrimary?: boolean
      notes?: string | null
    },
  ): CustomerContact {
    if (!this.getCustomer(input.customerId)) throw new Error('找不到客戶')
    const name = assertContactName(input.name)
    const now = new Date().toISOString()
    const row: CustomerContact = {
      id: `ccon-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      customerId: input.customerId,
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      isPrimary: Boolean(input.isPrimary),
      notes: input.notes?.trim() || null,
      createdAt: now,
    }
    const all = read(KEYS.customerContacts, emptyCustomerContacts)
    if (row.isPrimary) {
      for (const c of all) {
        if (c.customerId === input.customerId) c.isPrimary = false
      }
    }
    all.unshift(row)
    write(KEYS.customerContacts, all)
    return row
  },

  listCustomerSiteLinks(customerId?: string): CustomerSiteLink[] {
    const all = read(KEYS.customerSiteLinks, emptyCustomerSiteLinks)
    if (!customerId) return all
    return all.filter((l) => l.customerId === customerId)
  },

  linkCustomerToSite(
    _actor: { id: string },
    input: { customerId: string; siteId: string },
  ): CustomerSiteLink {
    if (!this.getCustomer(input.customerId)) throw new Error('找不到客戶')
    if (!this.getSites().some((s) => s.id === input.siteId)) {
      throw new Error('找不到工地／地址')
    }
    const existing = this.listCustomerSiteLinks()
    assertCanLinkCustomerToSite({
      customerId: input.customerId,
      siteId: input.siteId,
      existingLinks: existing,
    })
    const now = new Date().toISOString()
    const row: CustomerSiteLink = {
      id: `csl-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      customerId: input.customerId,
      siteId: input.siteId,
      createdAt: now,
    }
    const all = read(KEYS.customerSiteLinks, emptyCustomerSiteLinks)
    all.push(row)
    write(KEYS.customerSiteLinks, all)
    return row
  },

  getQuotations(): Quotation[] {
    return this.getAllQuotationsRaw().filter((q) => !q.deletedAt)
  },

  getAllQuotationsRaw(): Quotation[] {
    return read(KEYS.quotations, emptyQuotes).map(normalizeLocalQuote)
  },

  getQuotation(quoteId: string): Quotation | null {
    return this.getQuotations().find((q) => q.id === quoteId) ?? null
  },

  getQuotationItems(quotationId: string): QuotationItem[] {
    return read(KEYS.quotationItems, emptyQuoteItems)
      .filter((i) => i.quotationId === quotationId)
      .sort((a, b) => a.lineNo - b.lineNo)
  },

  getQuotationVersions(quotationId: string): QuotationVersion[] {
    return read(KEYS.quotationVersions, emptyQuoteVersions)
      .filter((v) => v.quotationId === quotationId && !v.deletedAt)
      .sort((a, b) => b.versionNo - a.versionNo)
  },

  recalcQuoteHeader(quoteId: string): Quotation {
    const all = read(KEYS.quotations, emptyQuotes).map(normalizeLocalQuote)
    const idx = all.findIndex((q) => q.id === quoteId && !q.deletedAt)
    if (idx < 0) throw new Error('找不到報價')
    const current = all[idx]
    assertQuoteDraftEditable({ workflowStatus: current.workflowStatus })
    const items = this.getQuotationItems(quoteId)
    const totals = calcQuoteTotals({
      items,
      discount: current.discount,
      taxMode: current.taxMode,
      taxRate: current.taxRate,
    })
    const next: Quotation = {
      ...current,
      amountBeforeTax: totals.subtotal,
      discount: totals.discount,
      taxAmount: totals.taxAmount,
      amountAfterTax: totals.total,
      taxRate: totals.taxRate,
      updatedAt: new Date().toISOString(),
      workflowStatus:
        current.workflowStatus === 'exported' ||
        current.workflowStatus === 'sent_to_customer'
          ? 'editing'
          : current.workflowStatus,
      status: legacyStatusFromWorkflow(
        current.workflowStatus === 'exported' ||
          current.workflowStatus === 'sent_to_customer'
          ? 'editing'
          : current.workflowStatus,
      ),
    }
    all[idx] = next
    write(KEYS.quotations, all)
    return next
  },

  createQuotation(input: {
    createdBy: string
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
  }): Quotation {
    assertQuoteAssociation(input)
    if (!input.taxMode) throw new Error('建立報價必須選擇稅務模式（REV-03）')
    const now = new Date().toISOString()
    const id = `quo-${crypto.randomUUID()}`
    const quote: Quotation = {
      id,
      organizationId: ORG_ID,
      projectId: input.projectId ?? null,
      repairCaseId: input.repairCaseId ?? null,
      title: input.title.trim(),
      status: 'draft',
      workflowStatus: 'editing',
      quoteNumber: `Q-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      customerName: (input.customerName || '').trim(),
      siteAddress: (input.siteAddress || '').trim(),
      taxMode: input.taxMode,
      taxRate: input.taxMode === 'zero' ? 0 : 0.05,
      amountBeforeTax: 0,
      discount: Number(input.discount ?? 0) || 0,
      taxAmount: 0,
      amountAfterTax: 0,
      notes: input.notes ?? null,
      paymentTerms: input.paymentTerms ?? '依約定',
      validUntil: input.validUntil ?? null,
      currentVersion: 0,
      lastExportedAt: null,
      frozen: false,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    }
    const all = this.getAllQuotationsRaw()
    all.unshift(quote)
    write(KEYS.quotations, all)
    return quote
  },

  updateQuotationMeta(
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
  ): Quotation {
    const all = this.getAllQuotationsRaw()
    const idx = all.findIndex((q) => q.id === quoteId)
    if (idx < 0) throw new Error('找不到報價')
    const current = all[idx]
    if (current.deletedAt) throw new Error('報價案件已刪除')
    assertQuoteDraftEditable({ workflowStatus: current.workflowStatus })
    all[idx] = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      workflowStatus:
        current.workflowStatus === 'exported' ||
        current.workflowStatus === 'sent_to_customer'
          ? 'editing'
          : current.workflowStatus,
    }
    write(KEYS.quotations, all)
    return this.recalcQuoteHeader(quoteId)
  },

  addQuotationItem(input: {
    quotationId: string
    kind: QuotationItemKind
    description: string
    qty: number
    unit?: string
    unitPrice: number
  }): QuotationItem {
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })

    const description = input.description.trim()
    if (!description) throw new Error('請填寫細項說明')
    const amount = calcQuoteItemAmount({
      qty: input.qty,
      unitPrice: input.unitPrice,
    })
    const existing = this.getQuotationItems(input.quotationId)
    const lineNo = existing.reduce((max, i) => Math.max(max, i.lineNo), 0) + 1
    const now = new Date().toISOString()
    const item: QuotationItem = {
      id: `qit-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      quotationId: input.quotationId,
      lineNo,
      kind: input.kind,
      description,
      qty: Number(input.qty),
      unit: (input.unit || '式').trim() || '式',
      unitPrice: Number(input.unitPrice),
      amount,
      createdAt: now,
      updatedAt: now,
    }
    const all = read(KEYS.quotationItems, emptyQuoteItems)
    all.push(item)
    write(KEYS.quotationItems, all)
    this.recalcQuoteHeader(input.quotationId)
    return item
  },

  updateQuotationItem(
    itemId: string,
    patch: Partial<{
      kind: QuotationItemKind
      description: string
      qty: number
      unit: string
      unitPrice: number
    }>,
  ): QuotationItem {
    const all = read(KEYS.quotationItems, emptyQuoteItems)
    const idx = all.findIndex((i) => i.id === itemId)
    if (idx < 0) throw new Error('找不到細項')
    const item = all[idx]
    const quote = this.getQuotation(item.quotationId)
    if (!quote) throw new Error('找不到報價')
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })
    const next = {
      ...item,
      ...patch,
      description: (patch.description ?? item.description).trim(),
      updatedAt: new Date().toISOString(),
    }
    next.amount = calcQuoteItemAmount({
      qty: next.qty,
      unitPrice: next.unitPrice,
    })
    all[idx] = next
    write(KEYS.quotationItems, all)
    this.recalcQuoteHeader(item.quotationId)
    return next
  },

  removeQuotationItem(itemId: string): void {
    const all = read(KEYS.quotationItems, emptyQuoteItems)
    const idx = all.findIndex((i) => i.id === itemId)
    if (idx < 0) throw new Error('找不到細項')
    const item = all[idx]
    const quote = this.getQuotation(item.quotationId)
    if (!quote) throw new Error('找不到報價')
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })
    all.splice(idx, 1)
    write(KEYS.quotationItems, all)
    this.recalcQuoteHeader(item.quotationId)
  },

  reorderQuotationItems(quotationId: string, orderedIds: string[]): void {
    const quote = this.getQuotation(quotationId)
    if (!quote) throw new Error('找不到報價')
    assertQuoteDraftEditable({ workflowStatus: quote.workflowStatus })
    const all = read(KEYS.quotationItems, emptyQuoteItems)
    const others = all.filter((i) => i.quotationId !== quotationId)
    const mine = all.filter((i) => i.quotationId === quotationId)
    const byId = new Map(mine.map((i) => [i.id, i]))
    const reordered: QuotationItem[] = []
    orderedIds.forEach((id, index) => {
      const row = byId.get(id)
      if (row) {
        reordered.push({
          ...row,
          lineNo: index + 1,
          updatedAt: new Date().toISOString(),
        })
        byId.delete(id)
      }
    })
    for (const leftover of byId.values()) {
      reordered.push({
        ...leftover,
        lineNo: reordered.length + 1,
      })
    }
    write(KEYS.quotationItems, [...others, ...reordered])
    this.recalcQuoteHeader(quotationId)
  },

  exportQuotationVersion(
    actor: { id: string; role: string },
    quoteId: string,
    format: QuoteExportFormat = 'snapshot',
  ): { quote: Quotation; version: QuotationVersion } {
    assertCanExportQuote(actor.role)
    const all = this.getAllQuotationsRaw()
    const idx = all.findIndex((q) => q.id === quoteId)
    if (idx < 0) throw new Error('找不到報價')
    const current = all[idx]
    if (current.deletedAt) throw new Error('報價案件已刪除')
    if (current.workflowStatus === 'cancelled') {
      throw new Error('已取消報價不可匯出')
    }
    const items = this.getQuotationItems(quoteId)
    const versionNo = current.currentVersion + 1
    const snapshot = buildQuoteExportSnapshot({
      quote: current,
      items,
      versionNo,
    })
    const version: QuotationVersion = {
      id: `qver-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      quotationId: quoteId,
      versionNo,
      quoteNumber: current.quoteNumber,
      snapshot,
      exportedAt: new Date().toISOString(),
      exportedBy: actor.id,
      exportFormat: format,
    }
    const versions = read(KEYS.quotationVersions, emptyQuoteVersions)
    versions.unshift(version)
    write(KEYS.quotationVersions, versions)
    const next: Quotation = {
      ...current,
      currentVersion: versionNo,
      lastExportedAt: version.exportedAt,
      workflowStatus: 'exported',
      status: 'published',
      updatedAt: version.exportedAt,
    }
    all[idx] = next
    write(KEYS.quotations, all)
    return { quote: next, version }
  },

  /** @deprecated use exportQuotationVersion */
  publishQuotation(quoteId: string, actorRole = 'boss'): Quotation {
    return this.exportQuotationVersion(
      { id: 'local', role: actorRole },
      quoteId,
      'snapshot',
    ).quote
  },

  setQuoteWorkflowStatus(
    actor: { id: string; role: string },
    quoteId: string,
    workflowStatus: QuoteWorkflowStatus,
  ): Quotation {
    if (
      workflowStatus === 'accepted' ||
      workflowStatus === 'rejected' ||
      workflowStatus === 'sent_to_customer'
    ) {
      assertCanMarkQuoteAccept(actor.role)
    }
    const all = read(KEYS.quotations, emptyQuotes).map(normalizeLocalQuote)
    const idx = all.findIndex((q) => q.id === quoteId && !q.deletedAt)
    if (idx < 0) throw new Error('找不到報價')
    const current = all[idx]
    if (
      workflowStatus === 'accepted' &&
      current.workflowStatus !== 'exported' &&
      current.workflowStatus !== 'sent_to_customer' &&
      current.workflowStatus !== 'rejected'
    ) {
      throw new Error('請先匯出或提供客戶後再標記接受')
    }
    const next: Quotation = {
      ...current,
      workflowStatus,
      status: legacyStatusFromWorkflow(workflowStatus),
      updatedAt: new Date().toISOString(),
    }
    all[idx] = next
    write(KEYS.quotations, all)
    return next
  },

  softDeleteQuotationVersion(
    actor: { id: string; role: string },
    versionId: string,
    reason?: string,
  ): void {
    const all = read(KEYS.quotationVersions, emptyQuoteVersions)
    const idx = all.findIndex((v) => v.id === versionId)
    if (idx < 0) throw new Error('找不到版本')
    const ver = all[idx]
    const quote = this.getQuotation(ver.quotationId)
    if (!quote) throw new Error('找不到報價')
    assertCanSoftDeleteQuoteVersion(actor.role, quote, ver)
    all[idx] = {
      ...ver,
      deletedAt: new Date().toISOString(),
      deletedBy: actor.id,
      deleteReason: reason?.trim() || '使用者刪除歷史版本',
    }
    write(KEYS.quotationVersions, all)
  },

  listChangeOrders(quotationId?: string): ChangeOrder[] {
    return read(KEYS.changeOrders, emptyChangeOrders)
      .filter((c) => (quotationId ? c.quotationId === quotationId : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  getChangeOrder(changeOrderId: string): ChangeOrder | null {
    return (
      read(KEYS.changeOrders, emptyChangeOrders).find(
        (c) => c.id === changeOrderId,
      ) ?? null
    )
  },

  getChangeOrderItems(changeOrderId: string): ChangeOrderItem[] {
    return read(KEYS.changeOrderItems, emptyChangeOrderItems)
      .filter((i) => i.changeOrderId === changeOrderId)
      .sort((a, b) => a.lineNo - b.lineNo)
  },

  createChangeOrder(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      kind: ChangeOrderKind
      title: string
      notes?: string
      discount?: number
    },
  ): ChangeOrder {
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canCreateChangeOrder(actor.role, quote)
    if (!gate.ok) throw new Error(gate.reason)
    const now = new Date().toISOString()
    const id = `cho-${crypto.randomUUID()}`
    const co: ChangeOrder = {
      id,
      organizationId: ORG_ID,
      quotationId: input.quotationId,
      changeNumber: `CO-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      kind: input.kind,
      title: input.title.trim() || (input.kind === 'addition' ? '追加' : '追減'),
      status: 'draft',
      taxMode: quote.taxMode,
      taxRate: quote.taxRate,
      amountBeforeTax: 0,
      discount: Number(input.discount ?? 0) || 0,
      taxAmount: 0,
      amountAfterTax: 0,
      notes: input.notes ?? null,
      acceptedAt: null,
      acceptedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.changeOrders, emptyChangeOrders)
    all.unshift(co)
    write(KEYS.changeOrders, all)
    return co
  },

  recalcChangeOrder(changeOrderId: string): ChangeOrder {
    const all = read(KEYS.changeOrders, emptyChangeOrders)
    const idx = all.findIndex((c) => c.id === changeOrderId)
    if (idx < 0) throw new Error('找不到追加減')
    const current = all[idx]
    assertChangeOrderEditable({ status: current.status })
    const items = this.getChangeOrderItems(changeOrderId)
    const totals = calcChangeOrderTotals({
      items,
      discount: current.discount,
      taxMode: current.taxMode,
      taxRate: current.taxRate,
    })
    const next: ChangeOrder = {
      ...current,
      amountBeforeTax: totals.subtotal,
      discount: totals.discount,
      taxAmount: totals.taxAmount,
      amountAfterTax: totals.total,
      taxRate: totals.taxRate,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = next
    write(KEYS.changeOrders, all)
    return next
  },

  addChangeOrderItem(input: {
    changeOrderId: string
    kind: QuotationItemKind
    description: string
    qty: number
    unit?: string
    unitPrice: number
  }): ChangeOrderItem {
    const co = this.getChangeOrder(input.changeOrderId)
    if (!co) throw new Error('找不到追加減')
    assertChangeOrderEditable({ status: co.status })
    const existing = this.getChangeOrderItems(input.changeOrderId)
    const amount = calcQuoteItemAmount({
      qty: input.qty,
      unitPrice: input.unitPrice,
    })
    const item: ChangeOrderItem = {
      id: `choi-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      changeOrderId: input.changeOrderId,
      lineNo: existing.length + 1,
      kind: input.kind,
      description: input.description.trim(),
      qty: input.qty,
      unit: input.unit || '式',
      unitPrice: input.unitPrice,
      amount,
      createdAt: new Date().toISOString(),
    }
    const all = read(KEYS.changeOrderItems, emptyChangeOrderItems)
    all.push(item)
    write(KEYS.changeOrderItems, all)
    this.recalcChangeOrder(input.changeOrderId)
    return item
  },

  removeChangeOrderItem(itemId: string): void {
    const all = read(KEYS.changeOrderItems, emptyChangeOrderItems)
    const item = all.find((i) => i.id === itemId)
    if (!item) throw new Error('找不到細項')
    const co = this.getChangeOrder(item.changeOrderId)
    if (!co) throw new Error('找不到追加減')
    assertChangeOrderEditable({ status: co.status })
    const others = all.filter((i) => i.changeOrderId !== item.changeOrderId)
    const mine = all
      .filter((i) => i.changeOrderId === item.changeOrderId && i.id !== itemId)
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((i, idx) => ({ ...i, lineNo: idx + 1 }))
    write(KEYS.changeOrderItems, [...others, ...mine])
    this.recalcChangeOrder(item.changeOrderId)
  },

  setChangeOrderStatus(
    actor: { id: string; role: string },
    changeOrderId: string,
    status: ChangeOrderStatus,
  ): ChangeOrder {
    if (
      status === 'accepted' ||
      status === 'rejected' ||
      status === 'sent_to_customer'
    ) {
      assertCanMarkChangeOrderAccept(actor.role)
    }
    const all = read(KEYS.changeOrders, emptyChangeOrders)
    const idx = all.findIndex((c) => c.id === changeOrderId)
    if (idx < 0) throw new Error('找不到追加減')
    const current = all[idx]
    if (current.status === 'accepted' || current.status === 'cancelled') {
      throw new Error('已接受或已取消的追加減不可再改狀態')
    }
    if (status === 'accepted') {
      const items = this.getChangeOrderItems(changeOrderId)
      if (items.length === 0) throw new Error('請先新增至少一筆細項再標記接受')
    }
    const now = new Date().toISOString()
    const next: ChangeOrder = {
      ...current,
      status,
      updatedAt: now,
      acceptedAt: status === 'accepted' ? now : current.acceptedAt,
      acceptedBy: status === 'accepted' ? actor.id : current.acceptedBy,
    }
    all[idx] = next
    write(KEYS.changeOrders, all)
    return next
  },

  listBillingMilestones(quotationId: string): BillingMilestone[] {
    return read(KEYS.billingMilestones, emptyBillingMilestones)
      .filter((m) => m.quotationId === quotationId)
      .sort((a, b) => a.sequence - b.sequence)
  },

  listBillingDocuments(quotationId?: string): BillingDocument[] {
    return read(KEYS.billingDocuments, emptyBillingDocuments)
      .filter((d) => (quotationId ? d.quotationId === quotationId : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  getBillingDocumentItems(documentId: string): BillingDocumentItem[] {
    return read(KEYS.billingDocumentItems, emptyBillingDocumentItems)
      .filter((i) => i.billingDocumentId === documentId)
      .sort((a, b) => a.lineNo - b.lineNo)
  },

  createBillingMilestone(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      code: string
      title: string
      plannedAmount: number
      sequence?: number
    },
  ): BillingMilestone {
    assertCanManageBilling(actor.role)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canCreateBillingForQuote(quote)
    if (!gate.ok) throw new Error(gate.reason)
    const code = input.code.trim().toUpperCase()
    if (!code) throw new Error('請款節點代碼不可空白')
    const existing = this.listBillingMilestones(input.quotationId)
    if (existing.some((m) => m.code === code)) {
      throw new Error('同一報價不可重複請款節點代碼')
    }
    const now = new Date().toISOString()
    const milestone: BillingMilestone = {
      id: `bms-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      quotationId: input.quotationId,
      code,
      title: input.title.trim() || code,
      sequence: input.sequence ?? existing.length + 1,
      plannedAmount: Math.max(0, Number(input.plannedAmount) || 0),
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.billingMilestones, emptyBillingMilestones)
    all.push(milestone)
    write(KEYS.billingMilestones, all)
    return milestone
  },

  createBillingDocument(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      milestoneId: string
      title?: string
      notes?: string
    },
  ): BillingDocument {
    assertCanManageBilling(actor.role)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canCreateBillingForQuote(quote)
    if (!gate.ok) throw new Error(gate.reason)
    const milestones = this.listBillingMilestones(input.quotationId)
    const milestone = milestones.find((m) => m.id === input.milestoneId)
    if (!milestone) throw new Error('找不到請款節點')
    if (milestone.status === 'cancelled') {
      throw new Error('已取消的請款節點不可開立請款')
    }
    const issued = this.listBillingDocuments(input.quotationId).filter(
      (d) => d.milestoneId === milestone.id && d.status === 'issued',
    )
    if (issued.length > 0) {
      throw new Error('此請款節點已有正式請款單，不得重複開立')
    }
    const now = new Date().toISOString()
    const id = `bd-${crypto.randomUUID()}`
    const doc: BillingDocument = {
      id,
      organizationId: ORG_ID,
      quotationId: input.quotationId,
      milestoneId: milestone.id,
      documentNumber: `BILL-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      title: (input.title || milestone.title).trim(),
      status: 'draft',
      taxMode: quote.taxMode,
      taxRate: quote.taxRate,
      amountBeforeTax: 0,
      taxAmount: 0,
      amountAfterTax: 0,
      notes: input.notes ?? null,
      snapshot: null,
      issuedAt: null,
      issuedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.billingDocuments, emptyBillingDocuments)
    all.unshift(doc)
    write(KEYS.billingDocuments, all)
    if (milestone.plannedAmount > 0) {
      this.addBillingDocumentItem({
        billingDocumentId: doc.id,
        description: milestone.title,
        qty: 1,
        unit: '式',
        unitPrice: milestone.plannedAmount,
      })
    }
    return this.listBillingDocuments(input.quotationId).find((d) => d.id === doc.id)!
  },

  recalcBillingDocument(documentId: string): BillingDocument {
    const all = read(KEYS.billingDocuments, emptyBillingDocuments)
    const idx = all.findIndex((d) => d.id === documentId)
    if (idx < 0) throw new Error('找不到請款單')
    const current = all[idx]
    assertBillingDocumentEditable({ status: current.status })
    const items = this.getBillingDocumentItems(documentId)
    const totals = calcBillingTotals({
      items,
      taxMode: current.taxMode,
      taxRate: current.taxRate,
    })
    const next: BillingDocument = {
      ...current,
      amountBeforeTax: totals.amountBeforeTax,
      taxAmount: totals.taxAmount,
      amountAfterTax: totals.amountAfterTax,
      taxRate: totals.taxRate,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = next
    write(KEYS.billingDocuments, all)
    return next
  },

  addBillingDocumentItem(input: {
    billingDocumentId: string
    description: string
    qty: number
    unit?: string
    unitPrice: number
  }): BillingDocumentItem {
    const docs = read(KEYS.billingDocuments, emptyBillingDocuments)
    const doc = docs.find((d) => d.id === input.billingDocumentId)
    if (!doc) throw new Error('找不到請款單')
    assertBillingDocumentEditable({ status: doc.status })
    const existing = this.getBillingDocumentItems(input.billingDocumentId)
    const amount = calcQuoteItemAmount({
      qty: input.qty,
      unitPrice: input.unitPrice,
    })
    const item: BillingDocumentItem = {
      id: `bdi-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      billingDocumentId: input.billingDocumentId,
      lineNo: existing.length + 1,
      description: input.description.trim(),
      qty: input.qty,
      unit: input.unit || '式',
      unitPrice: input.unitPrice,
      amount,
      createdAt: new Date().toISOString(),
    }
    const all = read(KEYS.billingDocumentItems, emptyBillingDocumentItems)
    all.push(item)
    write(KEYS.billingDocumentItems, all)
    this.recalcBillingDocument(input.billingDocumentId)
    return item
  },

  issueBillingDocument(
    actor: { id: string; role: string },
    documentId: string,
  ): BillingDocument {
    assertCanManageBilling(actor.role)
    const all = read(KEYS.billingDocuments, emptyBillingDocuments)
    const idx = all.findIndex((d) => d.id === documentId)
    if (idx < 0) throw new Error('找不到請款單')
    const current = all[idx]
    assertBillingDocumentEditable({ status: current.status })
    const items = this.getBillingDocumentItems(documentId)
    if (items.length === 0) throw new Error('請先新增請款細項再開立')
    const fresh = this.recalcBillingDocument(documentId)
    const quote = this.getQuotation(fresh.quotationId)
    if (!quote) throw new Error('找不到報價')
    const contract = effectiveContractAmountWithChangeOrders({
      quotes: [quote],
      changeOrders: this.listChangeOrders(quote.id),
    })
    const alreadyIssued = sumIssuedBillingAmount(
      this.listBillingDocuments(quote.id),
    )
    assertIssueDoesNotExceedContract({
      contract,
      alreadyIssued,
      issuingAmount: fresh.amountAfterTax,
    })
    const otherIssued = this.listBillingDocuments(quote.id).some(
      (d) =>
        d.milestoneId === fresh.milestoneId &&
        d.status === 'issued' &&
        d.id !== fresh.id,
    )
    if (otherIssued) {
      throw new Error('此請款節點已有正式請款單，不得重複開立')
    }
    const milestones = read(KEYS.billingMilestones, emptyBillingMilestones)
    const mIdx = milestones.findIndex((m) => m.id === fresh.milestoneId)
    if (mIdx < 0) throw new Error('找不到請款節點')
    const milestone = milestones[mIdx]
    const now = new Date().toISOString()
    const snapshot = buildBillingSnapshot({
      document: fresh,
      milestone,
      quote,
      items,
      issuedAt: now,
    })
    const next: BillingDocument = {
      ...fresh,
      status: 'issued',
      snapshot,
      issuedAt: now,
      issuedBy: actor.id,
      updatedAt: now,
    }
    const docs = read(KEYS.billingDocuments, emptyBillingDocuments)
    const dIdx = docs.findIndex((d) => d.id === documentId)
    docs[dIdx] = next
    write(KEYS.billingDocuments, docs)
    milestones[mIdx] = {
      ...milestone,
      status: 'billed',
      updatedAt: now,
    }
    write(KEYS.billingMilestones, milestones)
    return next
  },

  listCustomerPayments(quotationId: string): CustomerPayment[] {
    return read(KEYS.customerPayments, emptyCustomerPayments)
      .filter((p) => p.quotationId === quotationId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  },

  listPaymentAllocations(filters?: {
    paymentId?: string
    billingDocumentId?: string
    quotationId?: string
  }): PaymentAllocation[] {
    let rows = read(KEYS.paymentAllocations, emptyPaymentAllocations)
    if (filters?.paymentId) {
      rows = rows.filter((a) => a.paymentId === filters.paymentId)
    }
    if (filters?.billingDocumentId) {
      rows = rows.filter((a) => a.billingDocumentId === filters.billingDocumentId)
    }
    if (filters?.quotationId) {
      const payIds = new Set(
        this.listCustomerPayments(filters.quotationId).map((p) => p.id),
      )
      rows = rows.filter((a) => payIds.has(a.paymentId))
    }
    return rows
  },

  listCustomerAdvances(quotationId: string): CustomerAdvance[] {
    return read(KEYS.customerAdvances, emptyCustomerAdvances)
      .filter((a) => a.quotationId === quotationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  listAdvanceApplications(filters?: {
    advanceId?: string
    billingDocumentId?: string
    quotationId?: string
  }): AdvanceApplication[] {
    let rows = read(KEYS.advanceApplications, emptyAdvanceApplications)
    if (filters?.advanceId) {
      rows = rows.filter((a) => a.advanceId === filters.advanceId)
    }
    if (filters?.billingDocumentId) {
      rows = rows.filter((a) => a.billingDocumentId === filters.billingDocumentId)
    }
    if (filters?.quotationId) {
      const advIds = new Set(
        this.listCustomerAdvances(filters.quotationId).map((a) => a.id),
      )
      rows = rows.filter((a) => advIds.has(a.advanceId))
    }
    return rows
  },

  createCustomerPayment(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      amount: number
      method: PaymentMethod
      notes?: string
      receivedAt?: string
    },
  ): CustomerPayment {
    assertCanManagePayments(actor.role)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canRecordPaymentForQuote(quote)
    if (!gate.ok) throw new Error(gate.reason)
    const amount = Number(input.amount) || 0
    if (amount <= 0) throw new Error('收款金額必須大於 0')
    const now = new Date().toISOString()
    const id = `pay-${crypto.randomUUID()}`
    const payment: CustomerPayment = {
      id,
      organizationId: ORG_ID,
      quotationId: quote.id,
      paymentNumber: `PAY-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      amount,
      method: input.method,
      status: 'confirmed',
      receivedAt: input.receivedAt || now,
      notes: input.notes ?? null,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.customerPayments, emptyCustomerPayments)
    all.unshift(payment)
    write(KEYS.customerPayments, all)
    return payment
  },

  allocatePayment(
    actor: { id: string; role: string },
    input: {
      paymentId: string
      billingDocumentId: string
      amount: number
    },
  ): PaymentAllocation {
    assertCanManagePayments(actor.role)
    const payments = read(KEYS.customerPayments, emptyCustomerPayments)
    const payment = payments.find((p) => p.id === input.paymentId)
    if (!payment || payment.status !== 'confirmed') {
      throw new Error('找不到已確認收款')
    }
    const docs = this.listBillingDocuments(payment.quotationId)
    const doc = docs.find((d) => d.id === input.billingDocumentId)
    if (!doc || doc.status !== 'issued') {
      throw new Error('只能分配到已開立的請款單')
    }
    const onPayment = this.listPaymentAllocations({ paymentId: payment.id })
    const onBilling = this.listPaymentAllocations({
      billingDocumentId: doc.id,
    })
    const onBillingAdv = this.listAdvanceApplications({
      billingDocumentId: doc.id,
    })
    const open = billingDocumentOpenAmount({
      document: doc,
      allocations: onBilling,
      advanceApplications: onBillingAdv,
    })
    assertAllocationFits({
      paymentAmount: payment.amount,
      alreadyAllocatedOnPayment: sumAllocations(onPayment),
      allocating: input.amount,
      billingOpenAmount: open,
    })
    const now = new Date().toISOString()
    const row: PaymentAllocation = {
      id: `pal-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      paymentId: payment.id,
      billingDocumentId: doc.id,
      amount: Number(input.amount),
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.paymentAllocations, emptyPaymentAllocations)
    all.push(row)
    write(KEYS.paymentAllocations, all)
    return row
  },

  createCustomerAdvance(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      amount: number
      notes?: string
      receivedAt?: string
    },
  ): CustomerAdvance {
    assertCanManagePayments(actor.role)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canRecordPaymentForQuote(quote)
    if (!gate.ok) throw new Error(gate.reason)
    const amount = Number(input.amount) || 0
    if (amount <= 0) throw new Error('預收金額必須大於 0')
    const now = new Date().toISOString()
    const id = `adv-${crypto.randomUUID()}`
    const advance: CustomerAdvance = {
      id,
      organizationId: ORG_ID,
      quotationId: quote.id,
      advanceNumber: `ADV-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      amount,
      remainingAmount: amount,
      status: 'open',
      receivedAt: input.receivedAt || now,
      notes: input.notes ?? null,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.customerAdvances, emptyCustomerAdvances)
    all.unshift(advance)
    write(KEYS.customerAdvances, all)
    return advance
  },

  applyCustomerAdvance(
    actor: { id: string; role: string },
    input: {
      advanceId: string
      billingDocumentId: string
      amount: number
    },
  ): AdvanceApplication {
    assertCanManagePayments(actor.role)
    const advances = read(KEYS.customerAdvances, emptyCustomerAdvances)
    const aIdx = advances.findIndex((a) => a.id === input.advanceId)
    if (aIdx < 0) throw new Error('找不到預收款')
    const advance = advances[aIdx]
    if (advance.status !== 'open') throw new Error('預收款已關閉或作廢')
    const docs = this.listBillingDocuments(advance.quotationId)
    const doc = docs.find((d) => d.id === input.billingDocumentId)
    if (!doc || doc.status !== 'issued') {
      throw new Error('只能抵充已開立的請款單')
    }
    const onBilling = this.listPaymentAllocations({
      billingDocumentId: doc.id,
    })
    const onBillingAdv = this.listAdvanceApplications({
      billingDocumentId: doc.id,
    })
    const open = billingDocumentOpenAmount({
      document: doc,
      allocations: onBilling,
      advanceApplications: onBillingAdv,
    })
    assertAdvanceApplicationFits({
      advanceRemaining: advance.remainingAmount,
      applying: input.amount,
      billingOpenAmount: open,
    })
    const amt = Number(input.amount)
    const now = new Date().toISOString()
    const row: AdvanceApplication = {
      id: `aap-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      advanceId: advance.id,
      billingDocumentId: doc.id,
      amount: amt,
      createdAt: now,
      createdBy: actor.id,
    }
    const apps = read(KEYS.advanceApplications, emptyAdvanceApplications)
    apps.push(row)
    write(KEYS.advanceApplications, apps)
    const remaining = Math.round((advance.remainingAmount - amt) * 100) / 100
    advances[aIdx] = {
      ...advance,
      remainingAmount: remaining,
      status: remaining <= 0.009 ? 'closed' : 'open',
    }
    write(KEYS.customerAdvances, advances)
    // Explicitly do NOT create a customer_payment — no new cash inflow
    return row
  },

  listCustomerCreditNotes(quotationId: string): CustomerCreditNote[] {
    return read(KEYS.customerCreditNotes, emptyCustomerCreditNotes)
      .filter((n) => n.quotationId === quotationId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  },

  listCustomerRefunds(quotationId: string): CustomerRefund[] {
    return read(KEYS.customerRefunds, emptyCustomerRefunds)
      .filter((r) => r.quotationId === quotationId)
      .sort((a, b) => b.refundedAt.localeCompare(a.refundedAt))
  },

  createCustomerCreditNote(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      amount: number
      reason: string
      billingDocumentId?: string | null
    },
  ): CustomerCreditNote {
    assertCanManageRefunds(actor.role)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canIssueCreditOrRefund(quote)
    if (!gate.ok) throw new Error(gate.reason)
    const billed = sumIssuedBillingAmount(
      this.listBillingDocuments(quote.id),
    )
    assertCreditNoteFits({
      billed,
      alreadyCredited: sumIssuedCredits(
        this.listCustomerCreditNotes(quote.id),
      ),
      crediting: input.amount,
    })
    if (input.billingDocumentId) {
      const doc = this.listBillingDocuments(quote.id).find(
        (d) => d.id === input.billingDocumentId,
      )
      if (!doc || doc.status !== 'issued') {
        throw new Error('折讓僅能關聯已開立請款單')
      }
    }
    const now = new Date().toISOString()
    const id = `cn-${crypto.randomUUID()}`
    const note: CustomerCreditNote = {
      id,
      organizationId: ORG_ID,
      quotationId: quote.id,
      billingDocumentId: input.billingDocumentId ?? null,
      creditNumber: `CN-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      amount: Number(input.amount),
      reason: input.reason.trim() || '折讓',
      status: 'issued',
      issuedAt: now,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.customerCreditNotes, emptyCustomerCreditNotes)
    all.unshift(note)
    write(KEYS.customerCreditNotes, all)
    return note
  },

  createCustomerRefund(
    actor: { id: string; role: string },
    input: {
      quotationId: string
      paymentId: string
      amount: number
      method: PaymentMethod
      reason: string
    },
  ): CustomerRefund {
    assertCanManageRefunds(actor.role)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    const gate = canIssueCreditOrRefund(quote)
    if (!gate.ok) throw new Error(gate.reason)
    const payment = this.listCustomerPayments(quote.id).find(
      (p) => p.id === input.paymentId,
    )
    if (!payment || payment.status !== 'confirmed') {
      throw new Error('退款必須對應已確認的原收款（原收款保留）')
    }
    const prior = this.listCustomerRefunds(quote.id)
    assertRefundFits({
      paymentAmount: payment.amount,
      alreadyRefundedOnPayment: refundsOnPayment(payment.id, prior),
      refunding: input.amount,
    })
    const now = new Date().toISOString()
    const id = `ref-${crypto.randomUUID()}`
    const refund: CustomerRefund = {
      id,
      organizationId: ORG_ID,
      quotationId: quote.id,
      paymentId: payment.id,
      refundNumber: `REF-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`,
      amount: Number(input.amount),
      method: input.method,
      status: 'confirmed',
      reason: input.reason.trim() || '退款',
      refundedAt: now,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.customerRefunds, emptyCustomerRefunds)
    all.unshift(refund)
    write(KEYS.customerRefunds, all)
    return refund
  },

  listCaseOperatingCosts(quotationId: string): CaseOperatingCost[] {
    return read(KEYS.caseOperatingCosts, emptyCaseOperatingCosts)
      .filter((c) => c.quotationId === quotationId)
      .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))
  },

  createCaseOperatingCost(
    actor: { id: string; role: string; financeAuthorized?: boolean },
    input: {
      quotationId: string
      kind: OperatingCostKind
      description: string
      amount: number
      warrantyFree?: boolean
    },
  ): CaseOperatingCost {
    assertCanRecordOperatingCost(
      actor.role,
      Boolean(actor.financeAuthorized),
    )
    assertOperatingCostAmount(input.amount)
    const quote = this.getQuotation(input.quotationId)
    if (!quote) throw new Error('找不到報價')
    if (quote.deletedAt) throw new Error('報價案件已刪除')
    const now = new Date().toISOString()
    const id = `cost-${crypto.randomUUID()}`
    const row: CaseOperatingCost = {
      id,
      organizationId: ORG_ID,
      quotationId: quote.id,
      kind: input.kind,
      description: input.description.trim() || '已確認營運成本',
      amount: Number(input.amount),
      status: 'confirmed',
      warrantyFree: Boolean(input.warrantyFree),
      confirmedAt: now,
      createdAt: now,
      createdBy: actor.id,
    }
    const all = read(KEYS.caseOperatingCosts, emptyCaseOperatingCosts)
    all.unshift(row)
    write(KEYS.caseOperatingCosts, all)
    return row
  },

  softDeleteQuotation(
    actor: { id: string; role: string },
    quoteId: string,
    reason?: string,
  ): void {
    const allRaw = this.getAllQuotationsRaw()
    const quote = allRaw.find((q) => q.id === quoteId) ?? null
    if (!quote) throw new Error('找不到報價')
    assertCanSoftDeleteQuoteCase(actor.role, quote)
    const now = new Date().toISOString()
    const all = allRaw
    const idx = all.findIndex((q) => q.id === quoteId)
    if (idx < 0) throw new Error('找不到報價')
    all[idx] = {
      ...all[idx],
      deletedAt: now,
      deletedBy: actor.id,
      deleteReason: reason?.trim() || '使用者刪除報價案件',
      updatedAt: now,
    }
    write(KEYS.quotations, all)
    const versions = read(KEYS.quotationVersions, emptyQuoteVersions).map((v) =>
      v.quotationId === quoteId && !v.deletedAt
        ? {
            ...v,
            deletedAt: now,
            deletedBy: actor.id,
            deleteReason: '隨案件刪除而隱藏',
          }
        : v,
    )
    write(KEYS.quotationVersions, versions)
  },

  getMaterials(): MaterialStock[] {
    const reserved = read(KEYS.stockReservations, emptyStockReservations)
    return read(KEYS.materials, emptyMaterials).map((m) => {
      const reservedQty = sumActiveReserved(
        reserved.filter((r) => r.materialId === m.id),
      )
      return {
        ...m,
        reservedQty,
        availableQty: roundMoney(m.qty - reservedQty, 4),
      }
    })
  },

  listMaterialUnits(materialId?: string): MaterialUnit[] {
    const all = read(KEYS.materialUnits, emptyMaterialUnits)
    return materialId ? all.filter((u) => u.materialId === materialId) : all
  },

  listMaterialSerials(materialId?: string): MaterialSerial[] {
    const all = read(KEYS.materialSerials, emptyMaterialSerials)
    const filtered = materialId
      ? all.filter((s) => s.materialId === materialId)
      : all
    return filtered.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber))
  },

  convertMaterialQtyFor(
    materialId: string,
    qty: number,
    fromCode: string,
    toCode: string,
  ): number {
    const units = this.listMaterialUnits(materialId)
    const from = units.find((u) => u.code === fromCode)
    const to = units.find((u) => u.code === toCode)
    if (!from || !to) throw new Error('找不到單位設定')
    return convertMaterialQty({
      qty,
      fromFactorToBase: from.factorToBase,
      toFactorToBase: to.factorToBase,
    })
  },

  addMaterialUnit(
    actor: { id: string; organizationId: string },
    input: {
      materialId: string
      code: string
      label: string
      factorToBase: number
    },
  ): MaterialUnit {
    const mat = read(KEYS.materials, emptyMaterials).find(
      (m) => m.id === input.materialId,
    )
    if (!mat) throw new Error('找不到材料')
    assertMaterialOrg(actor.organizationId, mat.organizationId)
    const code = input.code.trim()
    if (!code) throw new Error('單位代碼必填')
    const units = read(KEYS.materialUnits, emptyMaterialUnits)
    if (units.some((u) => u.materialId === mat.id && u.code === code)) {
      throw new Error('同一材料單位代碼不可重複')
    }
    const row: MaterialUnit = {
      id: `munit-${crypto.randomUUID()}`,
      organizationId: mat.organizationId,
      materialId: mat.id,
      code,
      label: input.label.trim() || code,
      factorToBase: assertUnitFactor(input.factorToBase),
      isBase: false,
    }
    units.push(row)
    write(KEYS.materialUnits, units)
    return row
  },

  registerMaterialSerial(
    actor: { id: string; organizationId: string },
    input: {
      materialId: string
      serialNumber: string
      unitCost: number
      locationId?: string | null
    },
  ): MaterialSerial {
    const mat = read(KEYS.materials, emptyMaterials).find(
      (m) => m.id === input.materialId,
    )
    if (!mat) throw new Error('找不到材料')
    assertMaterialOrg(actor.organizationId, mat.organizationId)
    if ((mat.trackingMode || 'quantity') !== 'serial') {
      throw new Error('僅序號追蹤材料可登錄序號')
    }
    const serial = assertSerialUniqueInOrg({
      serial: input.serialNumber,
      existingSerials: read(KEYS.materialSerials, emptyMaterialSerials).map(
        (s) => s.serialNumber,
      ),
    })
    const locationId = input.locationId || this.defaultWarehouseId()
    const row: MaterialSerial = {
      id: `ms-${crypto.randomUUID()}`,
      organizationId: mat.organizationId,
      materialId: mat.id,
      serialNumber: serial,
      status: 'in_stock',
      unitCost: roundMoney(Number(input.unitCost) || 0, 4),
      locationId,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
    }
    const all = read(KEYS.materialSerials, emptyMaterialSerials)
    all.push(row)
    write(KEYS.materialSerials, all)
    // Serial inbound: bump qty + location; cost uses individual serial cost (not MA).
    const materials = read(KEYS.materials, emptyMaterials)
    const idx = materials.findIndex((m) => m.id === mat.id)
    materials[idx] = {
      ...materials[idx],
      qty: roundMoney(materials[idx].qty + 1, 4),
      updatedAt: new Date().toISOString(),
    }
    write(KEYS.materials, materials)
    this.upsertBalance({
      materialId: mat.id,
      locationId,
      delta: 1,
    })
    this.appendMovement(
      { id: actor.id },
      {
        movementType: 'inbound',
        materialId: mat.id,
        materialName: mat.name,
        qty: 1,
        unitCost: row.unitCost,
        fromLocationId: null,
        toLocationId: locationId,
        reservationId: null,
        note: `序號 ${serial}`,
        clientOperationId: `serial-in-${row.id}`,
        reversalOf: null,
      },
    )
    return row
  },

  createLocalMaterial(
    actor: { id: string; organizationId: string },
    input: {
      name: string
      unit: string
      sku: string
      trackingMode?: 'quantity' | 'serial'
    },
  ): MaterialStock {
    const sku = assertSkuUniqueInOrg({
      sku: input.sku,
      existingSkus: read(KEYS.materials, emptyMaterials)
        .map((m) => m.sku || '')
        .filter(Boolean),
    })
    const unit = input.unit.trim() || '式'
    const now = new Date().toISOString()
    const row: MaterialStock = {
      id: `mat-${crypto.randomUUID()}`,
      organizationId: actor.organizationId || ORG_ID,
      name: input.name.trim(),
      unit,
      qty: 0,
      unitCost: 0,
      sku,
      trackingMode: input.trackingMode || 'quantity',
      baseUnitCode: unit,
      updatedAt: now,
    }
    if (!row.name) throw new Error('材料名稱必填')
    const all = read(KEYS.materials, emptyMaterials)
    all.push(row)
    write(KEYS.materials, all)
    const units = read(KEYS.materialUnits, emptyMaterialUnits)
    units.push({
      id: `munit-${crypto.randomUUID()}`,
      organizationId: row.organizationId,
      materialId: row.id,
      code: unit,
      label: unit,
      factorToBase: 1,
      isBase: true,
    })
    write(KEYS.materialUnits, units)
    return row
  },

  listStockLocations(): StockLocation[] {
    return read(KEYS.stockLocations, emptyStockLocations)
  },

  listStockBalances(materialId?: string): StockBalance[] {
    const all = read(KEYS.stockBalances, emptyStockBalances)
    return materialId ? all.filter((b) => b.materialId === materialId) : all
  },

  listStockMovements(materialId?: string): StockMovement[] {
    const all = read(KEYS.stockMovements, emptyStockMovements)
    const filtered = materialId
      ? all.filter((m) => m.materialId === materialId)
      : all
    return filtered.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  },

  listStockReservations(materialId?: string): StockReservation[] {
    const all = read(KEYS.stockReservations, emptyStockReservations)
    const filtered = materialId
      ? all.filter((r) => r.materialId === materialId)
      : all
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  defaultWarehouseId(): string {
    const locs = this.listStockLocations()
    const wh = locs.find((l) => l.isDefault) || locs.find((l) => l.kind === 'warehouse')
    if (!wh) throw new Error('尚未設定預設倉庫')
    return wh.id
  },

  upsertBalance(input: {
    materialId: string
    locationId: string
    delta: number
  }): StockBalance {
    const now = new Date().toISOString()
    const all = read(KEYS.stockBalances, emptyStockBalances)
    const idx = all.findIndex(
      (b) =>
        b.materialId === input.materialId && b.locationId === input.locationId,
    )
    if (idx < 0) {
      const nextQty = assertNoNegativeOnHand({ onHand: 0, delta: input.delta })
      const row: StockBalance = {
        id: `bal-${crypto.randomUUID()}`,
        organizationId: ORG_ID,
        materialId: input.materialId,
        locationId: input.locationId,
        qty: nextQty,
        updatedAt: now,
      }
      all.push(row)
      write(KEYS.stockBalances, all)
      return row
    }
    const current = all[idx]
    const nextQty = assertNoNegativeOnHand({
      onHand: current.qty,
      delta: input.delta,
    })
    const updated: StockBalance = { ...current, qty: nextQty, updatedAt: now }
    all[idx] = updated
    write(KEYS.stockBalances, all)
    return updated
  },

  appendMovement(
    actor: { id: string },
    input: Omit<StockMovement, 'id' | 'organizationId' | 'postedAt' | 'createdBy'>,
  ): StockMovement {
    const movements = read(KEYS.stockMovements, emptyStockMovements)
    if (
      movements.some((m) => m.clientOperationId === input.clientOperationId)
    ) {
      throw new Error('此庫存異動已過帳（冪等）')
    }
    const row: StockMovement = {
      ...input,
      id: `sm-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      postedAt: new Date().toISOString(),
      createdBy: actor.id,
    }
    movements.unshift(row)
    write(KEYS.stockMovements, movements)
    return row
  },

  /** INV-002: posted movements are immutable. */
  updateStockMovement(_id: string): never {
    return assertLedgerImmutable({ action: 'update' })
  },

  deleteStockMovement(_id: string): never {
    return assertLedgerImmutable({ action: 'delete' })
  },

  reserveStock(
    actor: { id: string },
    input: {
      materialId: string
      qty: number
      locationId?: string | null
      note?: string | null
      clientOperationId: string
    },
  ): StockReservation {
    const qty = assertPositiveQty(input.qty, '預留數量')
    const materials = read(KEYS.materials, emptyMaterials)
    const mat = materials.find((m) => m.id === input.materialId)
    if (!mat) throw new Error('找不到材料')
    const reserved = sumActiveReserved(
      read(KEYS.stockReservations, emptyStockReservations).filter(
        (r) => r.materialId === mat.id,
      ),
    )
    assertAvailableForConsume({
      onHand: mat.qty,
      reserved,
      qty,
      label: '預留數量',
    })
    const locationId = input.locationId || this.defaultWarehouseId()
    const locBal = this.listStockBalances(mat.id).find(
      (b) => b.locationId === locationId,
    )
    if (!locBal || locBal.qty + 0.0001 < qty) {
      throw new Error('庫位可用量不足，無法預留')
    }
    const now = new Date().toISOString()
    const row: StockReservation = {
      id: `sr-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      materialId: mat.id,
      locationId,
      qty,
      status: 'active',
      note: input.note?.trim() || null,
      clientOperationId: input.clientOperationId.trim(),
      createdAt: now,
      createdBy: actor.id,
      releasedAt: null,
    }
    const all = read(KEYS.stockReservations, emptyStockReservations)
    if (all.some((r) => r.clientOperationId === row.clientOperationId)) {
      throw new Error('此預留已建立（冪等）')
    }
    all.unshift(row)
    write(KEYS.stockReservations, all)
    this.appendMovement(actor, {
      movementType: 'reserve',
      materialId: mat.id,
      materialName: mat.name,
      qty,
      unitCost: mat.unitCost,
      fromLocationId: locationId,
      toLocationId: null,
      reservationId: row.id,
      note: row.note,
      clientOperationId: `mv-${row.clientOperationId}`,
      reversalOf: null,
    })
    return row
  },

  releaseReservation(
    actor: { id: string },
    input: { reservationId: string; clientOperationId: string },
  ): StockReservation {
    const all = read(KEYS.stockReservations, emptyStockReservations)
    const idx = all.findIndex((r) => r.id === input.reservationId)
    if (idx < 0) throw new Error('找不到預留')
    const current = all[idx]
    assertReservationRelease({
      status: current.status,
      releaseQty: current.qty,
      reservedQty: current.qty,
    })
    const now = new Date().toISOString()
    const updated: StockReservation = {
      ...current,
      status: 'released',
      releasedAt: now,
    }
    all[idx] = updated
    write(KEYS.stockReservations, all)
    const mat = read(KEYS.materials, emptyMaterials).find(
      (m) => m.id === current.materialId,
    )
    this.appendMovement(actor, {
      movementType: 'release',
      materialId: current.materialId,
      materialName: mat?.name || current.materialId,
      qty: current.qty,
      unitCost: mat?.unitCost || 0,
      fromLocationId: current.locationId || null,
      toLocationId: null,
      reservationId: current.id,
      note: null,
      clientOperationId: input.clientOperationId.trim(),
      reversalOf: null,
    })
    return updated
  },

  transferStock(
    actor: { id: string },
    input: {
      materialId: string
      qty: number
      fromLocationId: string
      toLocationId: string
      note?: string | null
      clientOperationId: string
    },
  ): StockMovement {
    const qty = assertPositiveQty(input.qty, '調撥數量')
    if (input.fromLocationId === input.toLocationId) {
      throw new Error('調撥來源與目的庫位不可相同')
    }
    const locs = this.listStockLocations()
    if (!locs.some((l) => l.id === input.fromLocationId)) {
      throw new Error('找不到來源庫位')
    }
    if (!locs.some((l) => l.id === input.toLocationId)) {
      throw new Error('找不到目的庫位')
    }
    const materials = read(KEYS.materials, emptyMaterials)
    const idx = materials.findIndex((m) => m.id === input.materialId)
    if (idx < 0) throw new Error('找不到材料')
    const mat = materials[idx]
    const reserved = sumActiveReserved(
      read(KEYS.stockReservations, emptyStockReservations).filter(
        (r) => r.materialId === mat.id,
      ),
    )
    assertAvailableForConsume({
      onHand: mat.qty,
      reserved,
      qty,
      label: '調撥數量',
    })
    const beforeUnitCost = mat.unitCost
    const beforeOrgQty = mat.qty
    this.upsertBalance({
      materialId: mat.id,
      locationId: input.fromLocationId,
      delta: -qty,
    })
    this.upsertBalance({
      materialId: mat.id,
      locationId: input.toLocationId,
      delta: qty,
    })
    // Org cost pool unchanged — transfer ≠ usage.
    assertTransferDoesNotAffectCost({
      beforeUnitCost,
      afterUnitCost: mat.unitCost,
      beforeOrgQty,
      afterOrgQty: mat.qty,
    })
    return this.appendMovement(actor, {
      movementType: 'transfer',
      materialId: mat.id,
      materialName: mat.name,
      qty,
      unitCost: mat.unitCost,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      reservationId: null,
      note: input.note?.trim() || null,
      clientOperationId: input.clientOperationId.trim(),
      reversalOf: null,
    })
  },

  listMaterialUsages(repairCaseId?: string): MaterialUsage[] {
    const all = read(KEYS.materialUsages, emptyMaterialUsages)
    const filtered = repairCaseId
      ? all.filter((u) => u.repairCaseId === repairCaseId)
      : all
    return filtered.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  },

  postMaterialUsage(
    actor: { id: string },
    input: {
      materialId: string
      qty: number
      repairCaseId?: string | null
      siteId?: string | null
      note?: string | null
      clientOperationId: string
    },
  ): MaterialUsage {
    const qty = assertUsageQty(input.qty)
    const usages = read(KEYS.materialUsages, emptyMaterialUsages)
    assertUsageNotAlreadyPosted({
      clientOperationId: input.clientOperationId,
      existingOperationIds: usages.map((u) => u.clientOperationId),
    })
    if (input.repairCaseId && !this.getRepairCase(input.repairCaseId)) {
      throw new Error('找不到維修案件')
    }
    const materials = read(KEYS.materials, emptyMaterials)
    const idx = materials.findIndex((m) => m.id === input.materialId)
    if (idx < 0) throw new Error('找不到材料')
    const material = materials[idx]
    const reservedQty = sumActiveReserved(
      read(KEYS.stockReservations, emptyStockReservations).filter(
        (r) => r.materialId === material.id,
      ),
    )
    assertAvailableForConsume({
      onHand: material.qty,
      reserved: reservedQty,
      qty,
      label: '耗用數量',
    })
    assertNoNegativeStock({
      availableQty: material.qty - reservedQty,
      usageQty: qty,
    })
    const unitCost = material.unitCost
    const totalCost = computeUsageCost({ qty, unitCost })
    const now = new Date().toISOString()
    const locationId = this.defaultWarehouseId()
    this.upsertBalance({
      materialId: material.id,
      locationId,
      delta: -qty,
    })
    materials[idx] = {
      ...material,
      qty: roundMoney(material.qty - qty, 4),
      updatedAt: now,
    }
    write(KEYS.materials, materials)
    const row: MaterialUsage = {
      id: `mu-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      materialId: material.id,
      materialName: material.name,
      qty,
      unitCost,
      totalCost,
      repairCaseId: input.repairCaseId || null,
      siteId: input.siteId || null,
      note: input.note?.trim() || null,
      clientOperationId: input.clientOperationId.trim(),
      postedAt: now,
      createdBy: actor.id,
    }
    usages.unshift(row)
    write(KEYS.materialUsages, usages)
    this.appendMovement(actor, {
      movementType: 'usage',
      materialId: material.id,
      materialName: material.name,
      qty,
      unitCost,
      fromLocationId: locationId,
      toLocationId: null,
      reservationId: null,
      note: row.note,
      clientOperationId: `mv-usage-${row.clientOperationId}`,
      reversalOf: null,
    })
    return row
  },

  /**
   * Create a repair-only quote and add material lines from usages (cost → sell at cost for draft).
   * Does not require a project (XOR repair).
   */
  createQuoteFromRepairUsages(
    actor: { id: string; role: string },
    input: {
      repairCaseId: string
      title?: string
      taxMode?: TaxMode
    },
  ): Quotation {
    const repair = this.getRepairCase(input.repairCaseId)
    if (!repair) throw new Error('找不到維修案件')
    const usages = this.listMaterialUsages(repair.id)
    if (usages.length === 0) throw new Error('尚無耗用可轉報價')
    const quote = this.createQuotation({
      createdBy: actor.id,
      title: input.title || `維修報價 · ${repair.problemDescription}`,
      repairCaseId: repair.id,
      customerName: repair.customerName || '',
      taxMode: input.taxMode || 'zero',
    })
    for (const u of usages) {
      this.addQuotationItem({
        quotationId: quote.id,
        kind: 'material',
        description: `${u.materialName}（耗用）`,
        qty: u.qty,
        unitPrice: u.unitCost,
      })
    }
    return this.getQuotation(quote.id)!
  },

  inboundMaterial(
    input: {
      materialId: string
      qty: number
      unitCost: number
      locationId?: string | null
      clientOperationId?: string
      actorId?: string
    },
  ): MaterialStock {
    const all = read(KEYS.materials, emptyMaterials)
    const idx = all.findIndex((m) => m.id === input.materialId)
    if (idx < 0) throw new Error('找不到材料')
    const current = all[idx]
    const inboundQty = assertPositiveQty(input.qty, '入庫數量')
    const next = applyInboundMovingAverage({
      oldQty: current.qty,
      oldUnitCost: current.unitCost,
      inboundQty,
      inboundUnitCost: input.unitCost,
    })
    const locationId = input.locationId || this.defaultWarehouseId()
    this.upsertBalance({
      materialId: current.id,
      locationId,
      delta: inboundQty,
    })
    const updated: MaterialStock = {
      ...current,
      qty: next.qty,
      unitCost: next.unitCost,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    write(KEYS.materials, all)
    const actorId = input.actorId || 'system'
    this.appendMovement(
      { id: actorId },
      {
        movementType: 'inbound',
        materialId: current.id,
        materialName: current.name,
        qty: inboundQty,
        unitCost: roundMoney(input.unitCost, 4),
        fromLocationId: null,
        toLocationId: locationId,
        reservationId: null,
        note: null,
        clientOperationId:
          input.clientOperationId?.trim() ||
          `inbound-${crypto.randomUUID()}`,
        reversalOf: null,
      },
    )
    const reservedQty = sumActiveReserved(
      read(KEYS.stockReservations, emptyStockReservations).filter(
        (r) => r.materialId === updated.id,
      ),
    )
    return {
      ...updated,
      reservedQty,
      availableQty: roundMoney(updated.qty - reservedQty, 4),
    }
  },

  listPettyCashAccounts(): PettyCashAccount[] {
    return read(KEYS.pettyCashAccounts, emptyPettyCashAccounts)
  },

  listPettyCashRequests(): PettyCashTopUpRequest[] {
    return read(KEYS.pettyCashRequests, emptyPettyCashRequests).sort((a, b) =>
      b.requestedAt.localeCompare(a.requestedAt),
    )
  },

  listPettyCashLedger(accountId?: string): PettyCashLedgerEntry[] {
    const all = read(KEYS.pettyCashLedger, emptyPettyCashLedger)
    const filtered = accountId
      ? all.filter((e) => e.accountId === accountId)
      : all
    return filtered.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  },

  requestPettyCashTopUp(
    actor: { id: string; role: AppUser['role'] },
    input: { accountId: string; amount: number; reason: string },
  ): PettyCashTopUpRequest {
    assertCanRequest(actor.role)
    const amount = assertTopUpAmount(input.amount)
    const reason = input.reason.trim()
    if (!reason) throw new Error('請填寫補充原因')
    const account = this.listPettyCashAccounts().find(
      (a) => a.id === input.accountId,
    )
    if (!account) throw new Error('找不到零用金帳戶')
    const row: PettyCashTopUpRequest = {
      id: `pcr-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      accountId: account.id,
      amount,
      reason,
      status: 'pending_approval',
      requestedBy: actor.id,
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      rejectedReason: null,
      disbursementId: null,
    }
    const all = read(KEYS.pettyCashRequests, emptyPettyCashRequests)
    all.unshift(row)
    write(KEYS.pettyCashRequests, all)
    return row
  },

  approvePettyCashTopUp(
    actor: { id: string; role: AppUser['role'] },
    requestId: string,
  ): PettyCashTopUpRequest {
    assertCanApprove(actor.role)
    const all = read(KEYS.pettyCashRequests, emptyPettyCashRequests)
    const idx = all.findIndex((r) => r.id === requestId)
    if (idx < 0) throw new Error('找不到申請')
    const current = all[idx]
    assertRequestApprovable(current.status)
    const accounts = read(KEYS.pettyCashAccounts, emptyPettyCashAccounts)
    const account = accounts.find((a) => a.id === current.accountId)
    if (!account) throw new Error('找不到零用金帳戶')
    const balanceBefore = account.balance
    const updated: PettyCashTopUpRequest = {
      ...current,
      status: 'approved',
      approvedBy: actor.id,
      approvedAt: new Date().toISOString(),
    }
    all[idx] = updated
    write(KEYS.pettyCashRequests, all)
    assertApproveDoesNotCreditBalance({
      balanceBefore,
      balanceAfterApprove: account.balance,
    })
    return updated
  },

  rejectPettyCashTopUp(
    actor: { id: string; role: AppUser['role'] },
    input: { requestId: string; reason: string },
  ): PettyCashTopUpRequest {
    assertCanApprove(actor.role)
    const all = read(KEYS.pettyCashRequests, emptyPettyCashRequests)
    const idx = all.findIndex((r) => r.id === input.requestId)
    if (idx < 0) throw new Error('找不到申請')
    assertRequestApprovable(all[idx].status)
    const updated: PettyCashTopUpRequest = {
      ...all[idx],
      status: 'rejected',
      approvedBy: actor.id,
      approvedAt: new Date().toISOString(),
      rejectedReason: input.reason.trim() || '駁回',
    }
    all[idx] = updated
    write(KEYS.pettyCashRequests, all)
    return updated
  },

  disbursePettyCashTopUp(
    actor: { id: string; role: AppUser['role'] },
    input: { requestId: string; note?: string | null },
  ): PettyCashDisbursement {
    assertCanDisburse(actor.role)
    const requests = read(KEYS.pettyCashRequests, emptyPettyCashRequests)
    const rIdx = requests.findIndex((r) => r.id === input.requestId)
    if (rIdx < 0) throw new Error('找不到申請')
    const request = requests[rIdx]
    assertRequestDisbursable(request.status)
    const accounts = read(KEYS.pettyCashAccounts, emptyPettyCashAccounts)
    const aIdx = accounts.findIndex((a) => a.id === request.accountId)
    if (aIdx < 0) throw new Error('找不到零用金帳戶')
    const account = accounts[aIdx]
    const now = new Date().toISOString()
    const nextBalance = applyDisbursementCredit({
      balance: account.balance,
      amount: request.amount,
    })
    const disbursement: PettyCashDisbursement = {
      id: `pcd-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      requestId: request.id,
      accountId: account.id,
      amount: request.amount,
      disbursedBy: actor.id,
      disbursedAt: now,
      note: input.note?.trim() || null,
    }
    const disbursements = read(
      KEYS.pettyCashDisbursements,
      emptyPettyCashDisbursements,
    )
    disbursements.unshift(disbursement)
    write(KEYS.pettyCashDisbursements, disbursements)
    accounts[aIdx] = { ...account, balance: nextBalance, updatedAt: now }
    write(KEYS.pettyCashAccounts, accounts)
    requests[rIdx] = {
      ...request,
      status: 'disbursed',
      disbursementId: disbursement.id,
    }
    write(KEYS.pettyCashRequests, requests)
    const ledger = read(KEYS.pettyCashLedger, emptyPettyCashLedger)
    ledger.unshift({
      id: `pcl-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      accountId: account.id,
      entryType: 'top_up',
      amount: request.amount,
      balanceAfter: nextBalance,
      sourceType: 'disbursement',
      sourceId: disbursement.id,
      note: input.note?.trim() || `補充申請 ${request.id}`,
      postedAt: now,
      createdBy: actor.id,
    })
    write(KEYS.pettyCashLedger, ledger)
    return disbursement
  },

  appendAudit(
    actor: { id: string; name: string },
    input: {
      action: AuditAction
      targetType: string
      targetId: string
      before?: unknown
      after?: unknown
      result?: 'ok' | 'error'
      message?: string
    },
  ): AuditLogEntry {
    const built = buildAuditEntry({
      action: input.action,
      actorId: actor.id,
      actorName: actor.name,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before,
      after: input.after,
      result: input.result || 'ok',
      message: input.message,
    })
    const row: AuditLogEntry = {
      id: built.id,
      organizationId: ORG_ID,
      action: built.action,
      actorId: built.actorId,
      actorName: built.actorName,
      targetType: built.targetType,
      targetId: built.targetId,
      beforeJson: input.before == null ? null : JSON.stringify(input.before),
      afterJson: input.after == null ? null : JSON.stringify(input.after),
      result: built.result,
      message: built.message || null,
      createdAt: built.createdAt,
    }
    const all = read(KEYS.auditLogs, emptyAuditLogs)
    all.unshift(row)
    write(KEYS.auditLogs, all)
    return row
  },

  listAuditLogs(limit = 50): AuditLogEntry[] {
    return read(KEYS.auditLogs, emptyAuditLogs).slice(0, limit)
  },

  listExpenseReports(filter?: {
    status?: ExpenseReport['status']
    reportedBy?: string
  }): ExpenseReport[] {
    let all = read(KEYS.expenseReports, emptyExpenseReports)
    if (filter?.status) all = all.filter((e) => e.status === filter.status)
    if (filter?.reportedBy) {
      all = all.filter((e) => e.reportedBy === filter.reportedBy)
    }
    return all.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  },

  createExpenseReport(
    actor: { id: string; name: string; role: AppUser['role'] },
    input: {
      siteId: string
      item: string
      amount: number
      note?: string | null
      receiptPhotoPath?: string | null
    },
  ): ExpenseReport {
    const site = this.getSites(actor).find((s) => s.id === input.siteId)
    if (!site) throw new Error('找不到工地／案件')
    const amount = assertPositiveMoney(input.amount, '支出金額')
    const settings = this.getOrgSpendSettings()
    const needsReview = requiresBossReview(
      amount,
      settings.reportReviewThresholdNtd,
    )
    const now = new Date().toISOString()
    const row: ExpenseReport = {
      id: `exp-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      siteId: site.id,
      siteName: site.name,
      item: assertExpenseItem(input.item),
      amount,
      note: input.note?.trim() || null,
      receiptPhotoPath: input.receiptPhotoPath?.trim() || null,
      status: needsReview ? 'pending_review' : 'confirmed',
      reportedBy: actor.id,
      reportedByName: actor.name,
      reportedAt: now,
      reviewedBy: needsReview ? null : actor.id,
      reviewedAt: needsReview ? null : now,
      reviewNote: needsReview
        ? null
        : `小額免審（門檻 NT$${settings.reportReviewThresholdNtd.toLocaleString()}）`,
    }
    const all = read(KEYS.expenseReports, emptyExpenseReports)
    all.unshift(row)
    write(KEYS.expenseReports, all)
    this.appendAudit(actor, {
      action: 'expense.create',
      targetType: 'expense_report',
      targetId: row.id,
      after: row,
    })
    return row
  },

  reviewExpenseReport(
    actor: { id: string; name: string; role: AppUser['role'] },
    input: {
      id: string
      decision: 'confirm' | 'return' | 'cancel'
      note?: string | null
    },
  ): ExpenseReport {
    const all = read(KEYS.expenseReports, emptyExpenseReports)
    const idx = all.findIndex((e) => e.id === input.id)
    if (idx < 0) throw new Error('找不到支出回報')
    const current = all[idx]
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
    const updated: ExpenseReport = {
      ...current,
      status,
      reviewedBy: actor.id,
      reviewedAt: new Date().toISOString(),
      reviewNote: input.note?.trim() || null,
    }
    all[idx] = updated
    write(KEYS.expenseReports, all)
    this.appendAudit(actor, {
      action:
        input.decision === 'confirm'
          ? 'expense.confirm'
          : input.decision === 'return'
            ? 'expense.return'
            : 'expense.cancel',
      targetType: 'expense_report',
      targetId: updated.id,
      before: current,
      after: updated,
    })
    return updated
  },

  listCashReceipts(filter?: {
    status?: CashReceiptReport['status']
    reportedBy?: string
  }): CashReceiptReport[] {
    let all = read(KEYS.cashReceipts, emptyCashReceipts)
    if (filter?.status) all = all.filter((e) => e.status === filter.status)
    if (filter?.reportedBy) {
      all = all.filter((e) => e.reportedBy === filter.reportedBy)
    }
    return all.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  },

  createCashReceipt(
    actor: { id: string; name: string; role: AppUser['role'] },
    input: {
      siteId: string
      amount: number
      sourceNote?: string | null
      proofPhotoPath?: string | null
    },
  ): CashReceiptReport {
    const site = this.getSites(actor).find((s) => s.id === input.siteId)
    if (!site) throw new Error('找不到工地／案件')
    const row: CashReceiptReport = {
      id: `cr-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      siteId: site.id,
      siteName: site.name,
      amount: assertPositiveMoney(input.amount, '收款金額'),
      sourceNote: input.sourceNote?.trim() || null,
      proofPhotoPath: input.proofPhotoPath?.trim() || null,
      status: 'pending_confirm',
      reportedBy: actor.id,
      reportedByName: actor.name,
      reportedAt: new Date().toISOString(),
      confirmedBy: null,
      confirmedAt: null,
      confirmNote: null,
    }
    const all = read(KEYS.cashReceipts, emptyCashReceipts)
    all.unshift(row)
    write(KEYS.cashReceipts, all)
    this.appendAudit(actor, {
      action: 'receipt.create',
      targetType: 'cash_receipt',
      targetId: row.id,
      after: row,
    })
    return row
  },

  confirmCashReceipt(
    actor: { id: string; name: string; role: AppUser['role'] },
    input: {
      id: string
      decision: 'confirm' | 'return' | 'cancel'
      note?: string | null
    },
  ): CashReceiptReport {
    const all = read(KEYS.cashReceipts, emptyCashReceipts)
    const idx = all.findIndex((e) => e.id === input.id)
    if (idx < 0) throw new Error('找不到收款回報')
    const current = all[idx]
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
    const updated: CashReceiptReport = {
      ...current,
      status,
      confirmedBy: actor.id,
      confirmedAt: new Date().toISOString(),
      confirmNote: input.note?.trim() || null,
    }
    all[idx] = updated
    write(KEYS.cashReceipts, all)
    this.appendAudit(actor, {
      action:
        input.decision === 'confirm'
          ? 'receipt.confirm'
          : input.decision === 'return'
            ? 'receipt.return'
            : 'receipt.cancel',
      targetType: 'cash_receipt',
      targetId: updated.id,
      before: current,
      after: updated,
    })
    return updated
  },

  getOrgCaseFinanceSummary(acceptedContractTotal = 0) {
    const expenses = this.listExpenseReports()
    const receipts = this.listCashReceipts()
    return computeCaseFinance({
      acceptedContractAmount: acceptedContractTotal,
      confirmedExpenseTotal: expenses
        .filter((e) => e.status === 'confirmed')
        .reduce((s, e) => s + e.amount, 0),
      pendingExpenseTotal: expenses
        .filter((e) => e.status === 'pending_review')
        .reduce((s, e) => s + e.amount, 0),
      confirmedReceiptTotal: receipts
        .filter((e) => e.status === 'confirmed')
        .reduce((s, e) => s + e.amount, 0),
      pendingReceiptTotal: receipts
        .filter((e) => e.status === 'pending_confirm')
        .reduce((s, e) => s + e.amount, 0),
    })
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

  getOrgSpendSettings(): OrgSpendSettings {
    return read(KEYS.orgSpendSettings, defaultOrgSpendSettings(ORG_ID))
  },

  updateOrgSpendSettings(
    actor: { id: string; role: AppUser['role'] },
    input: {
      reportReviewThresholdNtd: number
      emergencySingleLimitNtd: number
      emergencyDailyLimitNtd: number
      dailyPurchaseLimitNtd: number
    },
  ): OrgSpendSettings {
    if (actor.role !== 'boss') throw new Error('僅老闆可設定額度')
    const next = assertSpendSettingsInput(input)
    const row: OrgSpendSettings = {
      organizationId: ORG_ID,
      ...next,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    }
    write(KEYS.orgSpendSettings, row)
    this.appendAudit(
      { id: actor.id, name: '老闆' },
      {
        action: 'permission.update',
        targetType: 'org_spend_settings',
        targetId: ORG_ID,
        after: row,
      },
    )
    return row
  },

  getShortcutIds(): string[] {
    const defaults = [
      'sites',
      'cash',
      'clock',
      'photos',
      'quotes',
      'todos',
      'team',
      'audit',
      'settings',
      'profile',
      'notices',
    ]
    const stored = read(KEYS.shortcuts, defaults)
    // Migrate away from advanced ERP shortcut ids in V1.0
    const blocked = new Set([
      'purchase',
      'inventory',
      'petty',
      'suppliers',
      'complaints',
      'analytics',
      'customers',
      'repairs',
      'reports',
    ])
    const filtered = stored.filter((id) => !blocked.has(id))
    const merged = [
      ...new Set([
        ...filtered,
        ...defaults.filter((d) => !filtered.includes(d)),
      ]),
    ]
    return merged.length ? merged : defaults
  },

  createAssignedTodo(
    actor: { id: string; name: string },
    input: {
      title: string
      detail?: string
      assigneeUserId: string
      href?: string | null
    },
  ): AppNotice {
    const title = input.title.trim()
    if (!title) throw new Error('請填寫待辦標題')
    const assignee = this.getUsers().find((u) => u.id === input.assigneeUserId)
    if (!assignee) throw new Error('找不到指派對象')
    const row: AppNotice = {
      id: `todo-${crypto.randomUUID()}`,
      organizationId: ORG_ID,
      userId: assignee.id,
      kind: 'todo',
      title,
      detail:
        input.detail?.trim() ||
        `由 ${actor.name} 指派`,
      status: 'open',
      unread: true,
      createdAt: new Date().toISOString(),
      href: input.href ?? '/todos',
    }
    const all = read(KEYS.notices, emptyNotices)
    all.unshift(row)
    write(KEYS.notices, all)
    this.appendAudit(actor, {
      action: 'todo.assign',
      targetType: 'todo',
      targetId: row.id,
      after: { ...row, assignedBy: actor.id },
    })
    return row
  },

  setShortcutIds(ids: string[]) {
    write(KEYS.shortcuts, ids)
  },
}
