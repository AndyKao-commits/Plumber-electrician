import { useCallback, useEffect, useState } from 'react'
import {
  isBrowserOnline,
  listOfflineQueue,
  pendingOfflineCount,
  type OfflineQueueItem,
} from '@/lib/offlineQueue'
import {
  flushOfflineQueue,
  notifyOfflineQueueChanged,
  startOfflineSyncListeners,
  subscribeOfflineQueue,
  type SyncFlushResult,
} from '@/lib/offlineSync'

export function useOfflineQueue() {
  const [online, setOnline] = useState(isBrowserOnline)
  const [items, setItems] = useState<OfflineQueueItem[]>(() => listOfflineQueue())
  const [pendingCount, setPendingCount] = useState(() => pendingOfflineCount())
  const [flushing, setFlushing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncFlushResult | null>(null)

  const refresh = useCallback(() => {
    setItems(listOfflineQueue())
    setPendingCount(pendingOfflineCount())
    setOnline(isBrowserOnline())
  }, [])

  useEffect(() => {
    startOfflineSyncListeners()
    const unsub = subscribeOfflineQueue(refresh)
    const onOnline = () => {
      setOnline(true)
      refresh()
    }
    const onOffline = () => {
      setOnline(false)
      refresh()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      unsub()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh])

  const flush = useCallback(async () => {
    setFlushing(true)
    try {
      const result = await flushOfflineQueue()
      setLastResult(result)
      refresh()
      notifyOfflineQueueChanged()
      return result
    } finally {
      setFlushing(false)
    }
  }, [refresh])

  return {
    online,
    items,
    pendingCount,
    flushing,
    lastResult,
    flush,
    refresh,
  }
}
