import { AppError, toUserMessage } from '@/lib/errors'
import {
  claimNextPending,
  isBrowserOnline,
  listOfflineQueue,
  removeSyncedOfflineItems,
  updateOfflineQueueItem,
  type OfflineQueueItem,
} from '@/lib/offlineQueue'
import { isFormalMode } from '@/lib/dataMode'
import { removeFormalAttendanceDraftByClientOp } from '@/lib/formalOfflineDrafts'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { localDb } from '@/lib/localDb'

export type SyncFlushResult = {
  processed: number
  synced: number
  failed: number
  conflict: number
}

let flushing = false
const listeners = new Set<() => void>()

export function subscribeOfflineQueue(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyOfflineQueueChanged() {
  for (const l of listeners) l()
}

async function executeItem(item: OfflineQueueItem): Promise<string | null> {
  const formal = isFormalMode()
  const payload = item.payload

  if (formal) {
    const claim = await supabaseRepos.claimSyncOperation({
      clientOperationId: item.clientOperationId,
      operationType: item.operationType,
      requestHash: item.requestHash,
      payload,
    })
    if (claim.alreadyDone) {
      return claim.serverResourceId
    }
  }

  let serverResourceId: string | null = null

  switch (item.operationType) {
    case 'construction_report': {
      if (!formal) throw new AppError('本機示範模式不支援離線施工回報同步')
      const report = await supabaseRepos.createConstructionReport({
        siteId: String(payload.siteId ?? ''),
        body: typeof payload.body === 'string' ? payload.body : '',
        photoUploadId:
          typeof payload.photoUploadId === 'string' ? payload.photoUploadId : null,
      })
      serverResourceId = report.id
      break
    }
    case 'manual_todo': {
      if (!formal) throw new AppError('本機示範模式不支援離線待辦同步')
      await supabaseRepos.createManualTodo({
        title: String(payload.title ?? ''),
        detail: typeof payload.detail === 'string' ? payload.detail : '',
        href: typeof payload.href === 'string' ? payload.href : null,
      })
      serverResourceId = item.clientOperationId
      break
    }
    case 'attendance_clock_in': {
      const userId = String(payload.userId ?? '')
      if (formal) {
        const record = await supabaseRepos.clockIn({
          userId,
          latitude:
            typeof payload.latitude === 'number' ? payload.latitude : null,
          longitude:
            typeof payload.longitude === 'number' ? payload.longitude : null,
        })
        serverResourceId = record.id
      } else {
        const user = localDb.getUser(userId)
        const record = {
          id: `att-${item.clientOperationId}`,
          organizationId: user?.organizationId ?? localDb.orgId,
          userId,
          status: 'clocked_in' as const,
          clockInAt: String(payload.clockInAt ?? new Date().toISOString()),
          latitude:
            typeof payload.latitude === 'number' ? payload.latitude : null,
          longitude:
            typeof payload.longitude === 'number' ? payload.longitude : null,
        }
        localDb.saveAttendance(record)
        serverResourceId = record.id
      }
      break
    }
    case 'attendance_clock_out': {
      const userId = String(payload.userId ?? '')
      if (formal) {
        const record = await supabaseRepos.clockOut(userId)
        serverResourceId = record.id
      } else {
        const open = localDb.getOpenAttendance(userId)
        if (!open) throw new AppError('目前沒有進行中的班次')
        const closed = {
          ...open,
          status: 'clocked_out' as const,
          clockOutAt: String(payload.clockOutAt ?? new Date().toISOString()),
        }
        localDb.saveAttendance(closed)
        serverResourceId = closed.id
      }
      break
    }
    case 'attendance_assign_site': {
      const userId = String(payload.userId ?? '')
      const siteId = String(payload.siteId ?? '')
      if (formal) {
        const record = await supabaseRepos.assignSite(userId, siteId)
        serverResourceId = record.id
      } else {
        const open = localDb.getOpenAttendance(userId)
        if (!open) throw new AppError('請先上班再選擇工地')
        const updated = {
          ...open,
          siteId,
          jobType: (payload.jobType as 'project' | 'repair' | undefined) ?? 'project',
        }
        localDb.saveAttendance(updated)
        serverResourceId = updated.id
      }
      break
    }
    case 'location_checkin': {
      if (!formal) throw new AppError('本機示範模式不需離線定位同步')
      const me = await supabaseRepos.getCurrentUser()
      if (!me) throw new AppError('同步定位前請先登入')
      const row = await supabaseRepos.createLocationCheckin(me, {
        label: typeof payload.label === 'string' ? payload.label : '目前位置',
        address: typeof payload.address === 'string' ? payload.address : null,
        latitude: typeof payload.latitude === 'number' ? payload.latitude : null,
        longitude:
          typeof payload.longitude === 'number' ? payload.longitude : null,
        source: 'web_gps',
      })
      serverResourceId = row.id
      break
    }
    case 'expense_report': {
      if (!formal) throw new AppError('本機示範模式不需離線支出同步')
      const me = await supabaseRepos.getCurrentUser()
      if (!me) throw new AppError('同步支出前請先登入')
      const row = await supabaseRepos.createExpenseReport(me, {
        siteId: payload.misc ? null : (payload.siteId as string | null),
        misc: Boolean(payload.misc),
        locationText:
          typeof payload.locationText === 'string' ? payload.locationText : null,
        item: String(payload.item ?? ''),
        amount: Number(payload.amount ?? 0),
        note: typeof payload.note === 'string' ? payload.note : null,
        receiptPhotoPath: null,
      })
      serverResourceId = row.id
      break
    }
    case 'cash_receipt': {
      if (!formal) throw new AppError('本機示範模式不需離線收款同步')
      const me = await supabaseRepos.getCurrentUser()
      if (!me) throw new AppError('同步收款前請先登入')
      const row = await supabaseRepos.createCashReceipt(me, {
        siteId: payload.misc ? null : (payload.siteId as string | null),
        misc: Boolean(payload.misc),
        locationText:
          typeof payload.locationText === 'string' ? payload.locationText : null,
        amount: Number(payload.amount ?? 0),
        sourceNote:
          typeof payload.sourceNote === 'string' ? payload.sourceNote : null,
        receivedOn:
          typeof payload.receivedOn === 'string' ? payload.receivedOn : null,
        quotationId:
          typeof payload.quotationId === 'string' ? payload.quotationId : null,
        proofPhotoPath: null,
      })
      serverResourceId = row.id
      break
    }
    default:
      throw new AppError('未知離線操作')
  }

  if (formal) {
    await supabaseRepos.completeSyncOperation({
      clientOperationId: item.clientOperationId,
      serverResourceId,
      status: 'accepted',
    })
    if (
      item.operationType === 'attendance_clock_in' ||
      item.operationType === 'attendance_clock_out' ||
      item.operationType === 'attendance_assign_site'
    ) {
      removeFormalAttendanceDraftByClientOp(item.clientOperationId)
    }
  }

  return serverResourceId
}

export async function flushOfflineQueue(): Promise<SyncFlushResult> {
  if (flushing) {
    return { processed: 0, synced: 0, failed: 0, conflict: 0 }
  }
  if (!isBrowserOnline()) {
    return { processed: 0, synced: 0, failed: 0, conflict: 0 }
  }

  flushing = true
  const result: SyncFlushResult = {
    processed: 0,
    synced: 0,
    failed: 0,
    conflict: 0,
  }

  try {
    removeSyncedOfflineItems()
    // Drain sequentially for attendance order safety
    for (;;) {
      const item = claimNextPending()
      if (!item) break
      result.processed += 1
      try {
        const serverResourceId = await executeItem(item)
        updateOfflineQueueItem(item.clientOperationId, {
          status: 'synced',
          serverResourceId,
          lastError: null,
        })
        result.synced += 1
      } catch (e) {
        const message = toUserMessage(e, '同步失敗')
        const isConflict =
          message.includes('IDEMPOTENCY') ||
          message.includes('衝突') ||
          message.includes('CONFLICT')
        updateOfflineQueueItem(item.clientOperationId, {
          status: isConflict ? 'conflict' : 'failed',
          lastError: message,
        })
        if (isConflict) result.conflict += 1
        else result.failed += 1

        if (isFormalMode()) {
          try {
            await supabaseRepos.completeSyncOperation({
              clientOperationId: item.clientOperationId,
              serverResourceId: null,
              status: isConflict ? 'conflict' : 'failed',
              errorMessage: message,
            })
          } catch {
            // best-effort audit
          }
        }
      }
      notifyOfflineQueueChanged()
    }
  } finally {
    flushing = false
    notifyOfflineQueueChanged()
  }

  return result
}

let started = false

export function startOfflineSyncListeners(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const kick = () => {
    void flushOfflineQueue()
  }

  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick()
  })

  // Initial pass if already online with pending items
  if (isBrowserOnline() && listOfflineQueue().some((i) => i.status === 'pending' || i.status === 'failed')) {
    kick()
  }
}
