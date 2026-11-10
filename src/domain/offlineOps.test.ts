import { beforeEach, describe, expect, it } from 'vitest'
import {
  assertOnlineForOp,
  hashRequestPayload,
  isOfflineAllowed,
  requiresOnline,
} from './offlineOps'
import {
  enqueueOfflineOp,
  listOfflineQueue,
  pendingOfflineCount,
  updateOfflineQueueItem,
} from '@/lib/offlineQueue'

function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  const memory = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: memory,
    configurable: true,
  })
}

beforeEach(() => {
  installMemoryLocalStorage()
  localStorage.clear()
})

describe('離線操作分類', () => {
  it('允許施工回報／待辦／出勤暫存', () => {
    expect(isOfflineAllowed('construction_report')).toBe(true)
    expect(isOfflineAllowed('manual_todo')).toBe(true)
    expect(isOfflineAllowed('attendance_clock_in')).toBe(true)
  })

  it('採購核准／庫存／報價發布必須連線', () => {
    expect(requiresOnline('purchase_approve')).toBe(true)
    expect(requiresOnline('inventory_inbound')).toBe(true)
    expect(requiresOnline('quote_publish')).toBe(true)
    expect(() => assertOnlineForOp('purchase_approve', false)).toThrow(/需連線/)
    expect(() => assertOnlineForOp('purchase_approve', true)).not.toThrow()
  })
})

describe('INT-10 冪等 hash', () => {
  it('相同內容相同 hash；鍵序無關', () => {
    const a = hashRequestPayload({ b: 1, a: 2 })
    const b = hashRequestPayload({ a: 2, b: 1 })
    expect(a).toBe(b)
  })

  it('不同內容不同 hash', () => {
    expect(hashRequestPayload({ x: 1 })).not.toBe(hashRequestPayload({ x: 2 }))
  })
})

describe('本機離線佇列', () => {
  it('enqueue 去重：同 clientOperationId 同內容回傳既有', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const first = enqueueOfflineOp({
      clientOperationId: id,
      operationType: 'manual_todo',
      payload: { title: 'A' },
    })
    const second = enqueueOfflineOp({
      clientOperationId: id,
      operationType: 'manual_todo',
      payload: { title: 'A' },
    })
    expect(second.clientOperationId).toBe(first.clientOperationId)
    expect(listOfflineQueue()).toHaveLength(1)
    expect(pendingOfflineCount()).toBe(1)
  })

  it('同 id 不同內容拒絕', () => {
    const id = '22222222-2222-2222-2222-222222222222'
    enqueueOfflineOp({
      clientOperationId: id,
      operationType: 'manual_todo',
      payload: { title: 'A' },
    })
    expect(() =>
      enqueueOfflineOp({
        clientOperationId: id,
        operationType: 'manual_todo',
        payload: { title: 'B' },
      }),
    ).toThrow(/IDEMPOTENCY/)
  })

  it('更新狀態後 pending 計數變化', () => {
    const item = enqueueOfflineOp({
      operationType: 'construction_report',
      payload: { siteId: 's1', body: 'ok' },
    })
    expect(pendingOfflineCount()).toBe(1)
    updateOfflineQueueItem(item.clientOperationId, { status: 'synced' })
    expect(pendingOfflineCount()).toBe(0)
  })
})
