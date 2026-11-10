import {
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
  assertQuoteAssociation,
  calcFinalPayable,
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
  Quotation,
  RepairCase,
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, user_id, site_id, mode, status, title, goods_amount, discount, tax, shipping, other_buyer_fees, final_payable, created_at, business_date, approved_by, approved_at, rejected_reason',
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
        'id, organization_id, project_id, repair_case_id, title, status, tax_mode, tax_rate, amount_before_tax, tax_amount, amount_after_tax, frozen, created_at, published_at, created_by',
      )
      .order('created_at', { ascending: false })
    if (error) throw new AppError(toUserMessage(error, '無法載入報價'))
    return (data ?? []).map((row) => ({
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
      createdBy: String(row.created_by),
    }))
  },

  async createQuotation(
    actor: AppUser,
    input: {
      title: string
      projectId?: string | null
      repairCaseId?: string | null
      taxMode: TaxMode
      amountBeforeTax: number
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
    const tax = calcQuoteTax({
      amountBeforeTax: input.amountBeforeTax,
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
        amount_before_tax: input.amountBeforeTax,
        tax_amount: tax.taxAmount,
        amount_after_tax: tax.amountAfterTax,
        frozen: false,
        created_by: actor.id,
      })
      .select(
        'id, organization_id, project_id, repair_case_id, title, status, tax_mode, tax_rate, amount_before_tax, tax_amount, amount_after_tax, frozen, created_at, published_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '無法建立報價'))
    const quote = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      projectId: (data.project_id as string | null) ?? null,
      repairCaseId: (data.repair_case_id as string | null) ?? null,
      title: String(data.title),
      status: data.status as Quotation['status'],
      taxMode: data.tax_mode as TaxMode,
      taxRate: Number(data.tax_rate),
      amountBeforeTax: Number(data.amount_before_tax),
      taxAmount: Number(data.tax_amount),
      amountAfterTax: Number(data.amount_after_tax),
      frozen: Boolean(data.frozen),
      createdAt: String(data.created_at),
      publishedAt: (data.published_at as string | null) ?? null,
      createdBy: String(data.created_by),
    }
    assertSameOrganization(actor.organizationId, quote.organizationId)
    return quote
  },

  async publishQuotation(actor: AppUser, quoteId: string): Promise<Quotation> {
    assertCanPublishQuote(actor.role)
    const qid = requireUuid(quoteId, '報價')
    const { data: current, error: loadError } = await sb()
      .from('quotations')
      .select(
        'id, organization_id, project_id, repair_case_id, title, status, tax_mode, tax_rate, amount_before_tax, tax_amount, amount_after_tax, frozen, created_at, published_at, created_by',
      )
      .eq('id', qid)
      .maybeSingle()
    if (loadError) throw new AppError(toUserMessage(loadError, '無法讀取報價'))
    if (!current) throw new AppError('找不到報價')
    assertSameOrganization(actor.organizationId, String(current.organization_id))
    if (current.frozen || current.status === 'published') {
      throw new AppError('報價已發布，稅務快照不可覆寫')
    }
    if (!current.tax_mode) throw new AppError('發布前必須已有稅務模式')

    const { data, error } = await sb()
      .from('quotations')
      .update({
        status: 'published',
        frozen: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', qid)
      .eq('frozen', false)
      .select(
        'id, organization_id, project_id, repair_case_id, title, status, tax_mode, tax_rate, amount_before_tax, tax_amount, amount_after_tax, frozen, created_at, published_at, created_by',
      )
      .single()
    if (error) throw new AppError(toUserMessage(error, '發布報價失敗'))
    const quote = {
      id: String(data.id),
      organizationId: String(data.organization_id),
      projectId: (data.project_id as string | null) ?? null,
      repairCaseId: (data.repair_case_id as string | null) ?? null,
      title: String(data.title),
      status: data.status as Quotation['status'],
      taxMode: data.tax_mode as TaxMode,
      taxRate: Number(data.tax_rate),
      amountBeforeTax: Number(data.amount_before_tax),
      taxAmount: Number(data.tax_amount),
      amountAfterTax: Number(data.amount_after_tax),
      frozen: Boolean(data.frozen),
      createdAt: String(data.created_at),
      publishedAt: (data.published_at as string | null) ?? null,
      createdBy: String(data.created_by),
    }
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
}
