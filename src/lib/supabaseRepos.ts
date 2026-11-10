import {
  assertCanAcceptQuote,
  assertCanApprovePurchase,
  assertCanPublishQuote,
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
  assertQuoteAcceptable,
  assertQuoteAssociation,
  assertQuoteDraftEditable,
  calcFinalPayable,
  calcQuoteItemAmount,
  calcQuoteTax,
  requiresPreApproval,
} from '@/domain/rules'
import type {
  AppNotice,
  AppUser,
  AttendanceRecord,
  MaterialStock,
  PurchaseMode,
  PurchaseRecord,
  ConstructionReport,
  DefectSeverity,
  PhotoUpload,
  Quotation,
  QuotationItem,
  QuotationItemKind,
  RepairCase,
  SiteDefect,
  SiteProject,
  TaxMode,
  TeamPresence,
  UserRole,
} from '@/domain/types'
import { AppError, toUserMessage } from '@/lib/errors'
import { formatTaipei } from '@/lib/time'
import { supabase } from '@/lib/supabase'

function sb() {
  if (!supabase) throw new AppError('尚未設定 Supabase，無法使用正式模式')
  return supabase
}

const QUOTE_SELECT =
  'id, organization_id, project_id, repair_case_id, title, status, tax_mode, tax_rate, amount_before_tax, tax_amount, amount_after_tax, frozen, created_at, published_at, accepted_at, accepted_by, acceptance_note, created_by'

function mapQuotationRow(row: Record<string, unknown>): Quotation {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    projectId: (row.project_id as string | null) ?? null,
    repairCaseId: (row.repair_case_id as string | null) ?? null,
    title: String(row.title),
    status: row.status as Quotation['status'],
    taxMode: row.tax_mode as TaxMode,
    taxRate: Number(row.tax_rate),
    amountBeforeTax: Number(row.amount_before_tax),
    taxAmount: Number(row.tax_amount),
    amountAfterTax: Number(row.amount_after_tax),
    frozen: Boolean(row.frozen),
    createdAt: String(row.created_at),
    publishedAt: (row.published_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    acceptedBy: (row.accepted_by as string | null) ?? null,
    acceptanceNote: (row.acceptance_note as string | null) ?? null,
    createdBy: String(row.created_by ?? ''),
  }
}

function mapUser(row: {
  id: string
  organization_id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  pay_type: AppUser['payType'] | null
  line_user_id: string | null
  finance_authorized: boolean | null
  created_at: string
}): AppUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    role: row.role as UserRole,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    payType: row.pay_type ?? undefined,
    lineUserId: row.line_user_id,
    financeAuthorized: Boolean(row.finance_authorized),
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

function mapPurchase(row: Record<string, unknown>): PurchaseRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    siteId: (row.site_id as string | null) ?? null,
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
  }
}

export const supabaseRepos = {
  async getCurrentUser(): Promise<AppUser | null> {
    const client = sb()
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError) throw new AppError(toUserMessage(authError, '無法取得登入狀態'))
    if (!auth.user) return null

    const { data, error } = await client
      .from('profiles')
      .select(
        'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, created_at',
      )
      .eq('id', auth.user.id)
      .maybeSingle()
    if (error) throw new AppError(toUserMessage(error, '無法讀取個人資料'))
    if (!data) return null
    return mapUser({ ...data, email: data.email ?? auth.user.email ?? null })
  },

  async signIn(email: string, password: string): Promise<AppUser> {
    const client = sb()
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new AppError(toUserMessage(error, '登入失敗'))
    if (!data.user) throw new AppError('登入失敗')

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select(
        'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, created_at',
      )
      .eq('id', data.user.id)
      .maybeSingle()
    if (profileError) throw new AppError(toUserMessage(profileError, '無法讀取個人資料'))
    if (!profile) throw new AppError('帳號已登入，但尚未建立 profiles 資料列')
    return mapUser({ ...profile, email: profile.email ?? data.user.email ?? null })
  },

  /**
   * Self-serve signup: Auth user + complete_signup RPC for org/profile.
   * - organizationName empty → join oldest existing org (or create default)
   * - organizationName set → create new company; first user becomes Owner
   */
  async signUp(input: {
    name: string
    email: string
    password: string
    organizationName?: string | null
  }): Promise<AppUser> {
    const client = sb()
    const name = input.name.trim()
    const email = input.email.trim()
    if (!name) throw new AppError('請填寫姓名')
    if (!email) throw new AppError('請填寫 Email')
    if (input.password.length < 6) throw new AppError('密碼至少 6 碼')

    const { data, error } = await client.auth.signUp({
      email,
      password: input.password,
      options: {
        data: { name },
      },
    })
    if (error) throw new AppError(toUserMessage(error, '建立帳號失敗'))
    if (!data.user) throw new AppError('建立帳號失敗')

    // Email confirmation enabled → no session yet
    if (!data.session) {
      throw new AppError(
        '帳號已建立，請至信箱完成驗證後再登入（若未收到信，請在 Supabase Auth 關閉「Confirm email」）',
      )
    }

    const { data: profile, error: profileError } = await client.rpc('complete_signup', {
      p_name: name,
      p_org_name: input.organizationName?.trim() || null,
    })
    if (profileError) {
      throw new AppError(toUserMessage(profileError, '帳號已建立，但無法建立個人資料'))
    }

    // rpc may return object or array depending on PostgREST
    const row = Array.isArray(profile) ? profile[0] : profile
    if (!row) throw new AppError('帳號已建立，但無法讀取個人資料')
    return mapUser({
      ...row,
      email: row.email ?? data.user.email ?? email,
    })
  },

  async signOut(): Promise<void> {
    const { error } = await sb().auth.signOut()
    if (error) throw new AppError(toUserMessage(error, '登出失敗'))
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
    return (data ?? []).map((row) => mapSite(row))
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
    return site
  },

  async createSite(
    actor: AppUser,
    input: {
      name: string
      kind: SiteProject['kind']
      address?: string
      customerName?: string
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
    return mapAttendance(data)
  },

  async listPurchases(actor: AppUser): Promise<PurchaseRecord[]> {
    let query = sb()
      .from('purchases')
      .select(
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
    const needsApproval = input.mode === 'normal' && requiresPreApproval(finalPayable)

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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
      .select('id, organization_id, site_id, customer_name, title, created_at')
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入維修案件'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      siteId: (row.site_id as string | null) ?? null,
      customerName: String(row.customer_name),
      title: String(row.title),
      createdAt: String(row.created_at),
    }))
  },

  async listQuotations(): Promise<Quotation[]> {
    const { data, error } = await sb()
      .from('quotations')
      .select(
        QUOTE_SELECT,
      )
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入報價'))
    return (data ?? []).map((row) =>
      mapQuotationRow(row as Record<string, unknown>),
    )
  },

  async createQuotation(
    actor: AppUser,
    input: {
      title: string
      projectId?: string | null
      repairCaseId?: string | null
      taxMode: TaxMode
      amountBeforeTax?: number
      taxRate?: number
    },
  ): Promise<Quotation> {
    assertPermission(actor.role, PERMISSIONS.QUOTE_CREATE, {
      financeAuthorized: actor.financeAuthorized,
    })
    const projectId = optionalUuid(input.projectId, '工程')
    const repairCaseId = optionalUuid(input.repairCaseId, '維修案件')
    assertQuoteAssociation({ projectId, repairCaseId })
    if (!input.taxMode) throw new AppError('建立報價必須選擇稅務模式（REV-03）')
    const amountBeforeTax = Number(input.amountBeforeTax ?? 0) || 0
    const tax = calcQuoteTax({
      amountBeforeTax,
      taxMode: input.taxMode,
      taxRate: input.taxRate,
    })

    const { data, error } = await sb()
      .from('quotations')
      .insert({
        project_id: projectId,
        repair_case_id: repairCaseId,
        title: input.title.trim(),
        status: 'draft',
        tax_mode: input.taxMode,
        tax_rate: tax.taxRate,
        amount_before_tax: amountBeforeTax,
        tax_amount: tax.taxAmount,
        amount_after_tax: tax.amountAfterTax,
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

  async publishQuotation(actor: AppUser, quoteId: string): Promise<Quotation> {
    assertCanPublishQuote(actor.role)
    const qid = requireUuid(quoteId, '報價')
    const { data: current, error: loadError } = await sb()
      .from('quotations')
      .select(QUOTE_SELECT)
      .eq('id', qid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取報價'))
    if (!current) throw new AppError('找不到報價')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    if (
      current.frozen ||
      current.status === 'published' ||
      current.status === 'accepted'
    ) {
      throw new AppError('報價已發布，稅務快照不可覆寫')
    }
    if (!current.tax_mode) throw new AppError('發布前必須已有稅務模式')

    const { count, error: itemsCountError } = await sb()
      .from('quotation_items')
      .select('id', { count: 'exact', head: true })
      .eq('quotation_id', qid)
    if (itemsCountError) {
      throw new AppError(toUserMessage(itemsCountError, '無法檢查報價細項'))
    }
    if (!count || count < 1) {
      throw new AppError('請先新增至少一筆報價細項再發布')
    }

    const { data, error } = await sb()
      .from('quotations')
      .update({
        status: 'published',
        frozen: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', qid)
      .eq('frozen', false)
      .select(QUOTE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '發布報價失敗'))
    const quote = mapQuotationRow(data as Record<string, unknown>)
    void safeNotifyApprovers({
      eventType: 'quote.published',
      title: `報價已發布：${quote.title}`,
      detail: `稅後金額 NT$${quote.amountAfterTax.toLocaleString()}`,
      href: '/quotes',
      asTodo: false,
    })
    if (quote.createdBy) {
      void safeNotify({
        recipientIds: [quote.createdBy],
        eventType: 'quote.published',
        title: `報價已發布：${quote.title}`,
        detail: `稅後金額 NT$${quote.amountAfterTax.toLocaleString()}`,
        href: '/quotes',
        asTodo: false,
      })
    }
    return quote
  },

  async acceptQuotation(
    actor: AppUser,
    quoteId: string,
    note?: string | null,
  ): Promise<Quotation> {
    assertCanAcceptQuote(actor.role)
    const qid = requireUuid(quoteId, '報價')
    const { data: current, error: loadError } = await sb()
      .from('quotations')
      .select(QUOTE_SELECT)
      .eq('id', qid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取報價'))
    if (!current) throw new AppError('找不到報價')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    assertQuoteAcceptable({
      status: String(current.status),
      frozen: Boolean(current.frozen),
    })

    const { data, error } = await sb()
      .from('quotations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: actor.id,
        acceptance_note: note?.trim() || null,
      })
      .eq('id', qid)
      .eq('status', 'published')
      .select(QUOTE_SELECT)
      .single()
    if (error) throw new AppError(toUserMessage(error, '登記接受失敗'))
    const quote = mapQuotationRow(data as Record<string, unknown>)
    if (quote.createdBy) {
      void safeNotify({
        recipientIds: [quote.createdBy],
        eventType: 'quote.accepted',
        title: `客戶已接受報價：${quote.title}`,
        detail: `有效合約金額 NT$${quote.amountAfterTax.toLocaleString()}`,
        href: '/quotes',
        asTodo: false,
      })
    }
    return quote
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
    const { data: quote, error: quoteError } = await sb()
      .from('quotations')
      .select('id, organization_id, status, frozen')
      .eq('id', qid)
      .maybeSingle()
    if (quoteError) throw new AppError(toUserMessage(quoteError, '無法讀取報價'))
    if (!quote) throw new AppError('找不到報價')
    assertSameOrganization(actor.organizationId, String(quote.organization_id))
    assertQuoteDraftEditable({
      frozen: Boolean(quote.frozen),
      status: String(quote.status),
    })

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

    const { data: quote, error: quoteError } = await sb()
      .from('quotations')
      .select('status, frozen')
      .eq('id', item.quotation_id)
      .maybeSingle()
    if (quoteError) throw new AppError(toUserMessage(quoteError, '無法讀取報價'))
    if (!quote) throw new AppError('找不到報價')
    assertQuoteDraftEditable({
      frozen: Boolean(quote.frozen),
      status: String(quote.status),
    })

    const { error } = await sb().from('quotation_items').delete().eq('id', iid)
    if (error) throw new AppError(toUserMessage(error, '無法刪除報價細項'))
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
      .select('id, organization_id, name, unit, qty, unit_cost, updated_at')
      .order('name', { ascending: true })
    if (error) throw new AppError(toUserMessage(error, '無法載入庫存'))
    return (data ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      name: String(row.name),
      unit: String(row.unit),
      qty: Number(row.qty),
      unitCost: Number(row.unit_cost),
      updatedAt: String(row.updated_at),
    }))
  },

  async inboundMaterial(
    actor: AppUser,
    input: {
      materialId: string
      qty: number
      unitCost: number
    },
  ): Promise<MaterialStock> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_INBOUND, {
      financeAuthorized: actor.financeAuthorized,
    })
    const materialId = requireUuid(input.materialId, '材料')
    if (input.qty <= 0) throw new AppError('入庫數量必須大於 0')
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
      inboundQty: input.qty,
      inboundUnitCost: input.unitCost,
    })
    if (next.qty < 0) throw new AppError('禁止負庫存')

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
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      name: String(data.name),
      unit: String(data.unit),
      qty: Number(data.qty),
      unitCost: Number(data.unit_cost),
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

  /** Team summary only — no GPS, notes, payroll, or clock detail times for others. */
  async listTeamPresence(): Promise<TeamPresence[]> {
    const { data: profiles, error: profileError } = await sb()
      .from('profiles')
      .select('id, name')
      .order('name', { ascending: true })
    if (profileError) throw new AppError(toUserMessage(profileError, '無法載入團隊'))

    const { data: opens, error: attError } = await sb()
      .from('attendance')
      .select('user_id, site_id')
      .eq('status', 'clocked_in')
    if (attError) throw new AppError(toUserMessage(attError, '無法載入到班狀態'))

    const siteIds = [
      ...new Set(
        (opens ?? [])
          .map((o) => o.site_id as string | null)
          .filter((id): id is string => Boolean(id)),
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

    const openByUser = new Map(
      (opens ?? []).map((o) => [String(o.user_id), o.site_id as string | null]),
    )

    return (profiles ?? []).map((p) => {
      const siteId = openByUser.get(String(p.id))
      const clockedIn = openByUser.has(String(p.id))
      return {
        userId: String(p.id),
        name: String(p.name),
        clockedIn,
        siteName: siteId ? siteNames.get(siteId) ?? null : null,
      }
    })
  },

  async listPhotoUploads(): Promise<PhotoUpload[]> {
    const { data, error } = await sb()
      .from('photo_uploads')
      .select(
        'id, organization_id, uploaded_by, site_id, storage_path, content_type, byte_size, source, status, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100)
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
      storagePath: String(row.storage_path),
      contentType: row.content_type ? String(row.content_type) : null,
      byteSize: row.byte_size == null ? null : Number(row.byte_size),
      source: String(row.source),
      status: row.status as PhotoUpload['status'],
      previewUrl: previewByPath.get(String(row.storage_path)) ?? null,
      createdAt: String(row.created_at),
    }))
  },

  async linkPhotoUpload(photoId: string, siteId: string): Promise<void> {
    const { error } = await sb()
      .from('photo_uploads')
      .update({ site_id: requireUuid(siteId, '工地'), status: 'linked' })
      .eq('id', requireUuid(photoId, '照片'))
    if (error) throw new AppError(toUserMessage(error, '無法指定工地'))
  },

  async discardPhotoUpload(photoId: string): Promise<void> {
    const { error } = await sb()
      .from('photo_uploads')
      .update({ status: 'discarded' })
      .eq('id', requireUuid(photoId, '照片'))
    if (error) throw new AppError(toUserMessage(error, '無法捨棄照片'))
  },

  async uploadAppPhoto(input: {
    file: File
    siteId?: string | null
  }): Promise<PhotoUpload> {
    const { data: authData, error: authError } = await sb().auth.getUser()
    if (authError) throw new AppError(toUserMessage(authError, '無法讀取登入狀態'))
    if (!authData.user) throw new AppError('尚未登入')

    const me = await this.getCurrentUser()
    if (!me) throw new AppError('找不到個人資料')

    const siteId = optionalUuid(input.siteId)
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

    const status = siteId ? 'linked' : 'pending'
    const { data, error } = await sb()
      .from('photo_uploads')
      .insert({
        organization_id: me.organizationId,
        uploaded_by: me.id,
        site_id: siteId,
        storage_path: path,
        content_type: mime,
        byte_size: input.file.size,
        source: 'app',
        status,
      })
      .select(
        'id, organization_id, uploaded_by, site_id, storage_path, content_type, byte_size, source, status, created_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法寫入照片紀錄'))

    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      uploadedBy: String(data.uploaded_by),
      siteId: data.site_id ? String(data.site_id) : null,
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

  async createMaterial(
    actor: AppUser,
    input: { name: string; unit: string },
  ): Promise<MaterialStock> {
    assertPermission(actor.role, PERMISSIONS.INVENTORY_INBOUND, {
      financeAuthorized: actor.financeAuthorized,
    })
    const name = input.name.trim()
    const unit = input.unit.trim() || '式'
    if (!name) throw new AppError('請填寫材料名稱')
    const { data, error } = await sb()
      .from('materials')
      .insert({
        organization_id: actor.organizationId,
        name,
        unit,
        qty: 0,
        unit_cost: 0,
      })
      .select('id, organization_id, name, unit, qty, unit_cost, updated_at')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立材料'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      name: String(data.name),
      unit: String(data.unit),
      qty: Number(data.qty),
      unitCost: Number(data.unit_cost),
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason, inbound_material_id, inbound_qty, inbound_at',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '入庫標記失敗'))
    return mapPurchase(data)
  },

  async createRepairCase(
    actor: AppUser,
    input: { title: string; customerName: string; siteId?: string | null },
  ): Promise<RepairCase> {
    const title = input.title.trim()
    const customerName = input.customerName.trim()
    if (!title) throw new AppError('請填寫維修標題')
    if (!customerName) throw new AppError('請填寫客戶名稱')
    const { data, error } = await sb()
      .from('repair_cases')
      .insert({
        organization_id: actor.organizationId,
        title,
        customer_name: customerName,
        site_id: optionalUuid(input.siteId, '工地'),
        created_by: actor.id,
      })
      .select('id, organization_id, site_id, customer_name, title, created_at')
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立維修案件'))
    return {
      id: String(data.id),
      organizationId: String(data.organization_id),
      siteId: (data.site_id as string | null) ?? null,
      customerName: String(data.customer_name),
      title: String(data.title),
      createdAt: String(data.created_at),
    }
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
}
