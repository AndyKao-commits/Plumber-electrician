import {
  hashRequestPayload,
  isOfflineAllowed,
  type OfflineAllowedOp,
} from '@/domain/offlineOps'

export type OfflineQueueStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict'

export interface OfflineQueueItem {
  clientOperationId: string
  operationType: OfflineAllowedOp
  payload: Record<string, unknown>
  requestHash: string
  status: OfflineQueueStatus
  attempts: number
  lastError?: string | null
  serverResourceId?: string | null
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'eg.offlineQueue.v1'
const MAX_ATTEMPTS = 8

function readAll(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflineQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: OfflineQueueItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function listOfflineQueue(): OfflineQueueItem[] {
  return readAll().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function pendingOfflineCount(): number {
  return readAll().filter((i) => i.status === 'pending' || i.status === 'failed').length
}

export function enqueueOfflineOp(input: {
  operationType: OfflineAllowedOp
  payload: Record<string, unknown>
  clientOperationId?: string
}): OfflineQueueItem {
  if (!isOfflineAllowed(input.operationType)) {
    throw new Error('此操作不可離線佇列')
  }
  const clientOperationId = input.clientOperationId ?? crypto.randomUUID()
  const requestHash = hashRequestPayload({
    type: input.operationType,
    payload: input.payload,
  })
  const now = new Date().toISOString()
  const all = readAll()
  const existing = all.find((i) => i.clientOperationId === clientOperationId)
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error('相同操作識別碼對應不同內容（IDEMPOTENCY_KEY_REUSED）')
    }
    return existing
  }
  const item: OfflineQueueItem = {
    clientOperationId,
    operationType: input.operationType,
    payload: input.payload,
    requestHash,
    status: 'pending',
    attempts: 0,
    lastError: null,
    serverResourceId: null,
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  writeAll(all)
  return item
}

export function updateOfflineQueueItem(
  clientOperationId: string,
  patch: Partial<
    Pick<
      OfflineQueueItem,
      'status' | 'attempts' | 'lastError' | 'serverResourceId' | 'updatedAt'
    >
  >,
): OfflineQueueItem | null {
  const all = readAll()
  const idx = all.findIndex((i) => i.clientOperationId === clientOperationId)
  if (idx < 0) return null
  const updated: OfflineQueueItem = {
    ...all[idx],
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  }
  all[idx] = updated
  writeAll(all)
  return updated
}

export function removeSyncedOfflineItems(olderThanMs = 1000 * 60 * 60 * 24): number {
  const cutoff = Date.now() - olderThanMs
  const before = readAll()
  const after = before.filter((i) => {
    if (i.status !== 'synced') return true
    return new Date(i.updatedAt).getTime() > cutoff
  })
  writeAll(after)
  return before.length - after.length
}

export function claimNextPending(): OfflineQueueItem | null {
  const all = readAll()
  const next = all.find(
    (i) =>
      (i.status === 'pending' || i.status === 'failed') &&
      i.attempts < MAX_ATTEMPTS,
  )
  if (!next) return null
  return updateOfflineQueueItem(next.clientOperationId, {
    status: 'syncing',
    attempts: next.attempts + 1,
  })
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export const OFFLINE_QUEUE_MAX_ATTEMPTS = MAX_ATTEMPTS
