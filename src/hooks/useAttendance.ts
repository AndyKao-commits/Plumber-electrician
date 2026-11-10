import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AttendanceRecord, JobType } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { enqueueOfflineOp, isBrowserOnline } from '@/lib/offlineQueue'
import { notifyOfflineQueueChanged } from '@/lib/offlineSync'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const attendanceKeys = {
  all: ['attendance'] as const,
  open: (userId: string) => [...attendanceKeys.all, 'open', userId] as const,
  history: (userId: string) => [...attendanceKeys.all, 'history', userId] as const,
}

async function getPosition(): Promise<{
  latitude: number | null
  longitude: number | null
}> {
  if (!('geolocation' in navigator)) return { latitude: null, longitude: null }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    )
  })
}

export function useAttendance(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const openQuery = useQuery({
    queryKey: attendanceKeys.open(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AttendanceRecord | null> => {
      if (!userId) return null
      try {
        return formal
          ? await supabaseRepos.getOpenAttendance(userId)
          : localDb.getOpenAttendance(userId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法讀取出勤狀態'))
      }
    },
  })

  const historyQuery = useQuery({
    queryKey: attendanceKeys.history(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AttendanceRecord[]> => {
      if (!userId) return []
      try {
        if (formal) return await supabaseRepos.listAttendance(userId)
        return localDb
          .getAttendance()
          .filter((a) => a.userId === userId)
          .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt))
      } catch (e) {
        throw new Error(toUserMessage(e, '無法讀取出勤紀錄'))
      }
    },
  })

  const invalidate = () => {
    if (!userId) return
    void queryClient.invalidateQueries({ queryKey: attendanceKeys.open(userId) })
    void queryClient.invalidateQueries({ queryKey: attendanceKeys.history(userId) })
    void queryClient.invalidateQueries({ queryKey: ['team'] })
  }

  const clockIn = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('尚未登入')
      const pos = await getPosition()
      try {
        if (!isBrowserOnline()) {
          const clockInAt = new Date().toISOString()
          const item = enqueueOfflineOp({
            operationType: 'attendance_clock_in',
            payload: {
              userId,
              latitude: pos.latitude,
              longitude: pos.longitude,
              clockInAt,
            },
          })
          notifyOfflineQueueChanged()
          // Local optimistic pending shift (demo + formal offline draft)
          const user = localDb.getUser(userId)
          const record: AttendanceRecord = {
            id: `pending-${item.clientOperationId}`,
            organizationId: user?.organizationId ?? localDb.orgId,
            userId,
            status: 'clocked_in',
            clockInAt,
            latitude: pos.latitude,
            longitude: pos.longitude,
            note: '離線待驗證',
          }
          if (!formal) localDb.saveAttendance(record)
          return record
        }
        if (formal) {
          return await supabaseRepos.clockIn({
            userId,
            latitude: pos.latitude,
            longitude: pos.longitude,
          })
        }
        const user = localDb.getUser(userId)
        const record: AttendanceRecord = {
          id: `att-${crypto.randomUUID()}`,
          organizationId: user?.organizationId ?? localDb.orgId,
          userId,
          status: 'clocked_in',
          clockInAt: new Date().toISOString(),
          latitude: pos.latitude,
          longitude: pos.longitude,
        }
        localDb.saveAttendance(record)
        return record
      } catch (e) {
        throw new Error(toUserMessage(e, '上班打卡失敗'))
      }
    },
    onSuccess: invalidate,
  })

  const clockOut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('尚未登入')
      try {
        if (!isBrowserOnline()) {
          const clockOutAt = new Date().toISOString()
          enqueueOfflineOp({
            operationType: 'attendance_clock_out',
            payload: { userId, clockOutAt },
          })
          notifyOfflineQueueChanged()
          if (!formal) {
            const open = localDb.getOpenAttendance(userId)
            if (!open) throw new Error('目前沒有進行中的班次')
            const closed = {
              ...open,
              status: 'clocked_out' as const,
              clockOutAt,
              note: open.note ? `${open.note}；離線下班待驗證` : '離線待驗證',
            }
            localDb.saveAttendance(closed)
            return closed
          }
          return {
            id: `pending-out-${crypto.randomUUID()}`,
            organizationId: '',
            userId,
            status: 'clocked_out' as const,
            clockInAt: clockOutAt,
            clockOutAt,
            note: '離線待驗證',
          }
        }
        if (formal) return await supabaseRepos.clockOut(userId)
        const open = localDb.getOpenAttendance(userId)
        if (!open) throw new Error('目前沒有進行中的班次')
        const closed = {
          ...open,
          status: 'clocked_out' as const,
          clockOutAt: new Date().toISOString(),
        }
        localDb.saveAttendance(closed)
        return closed
      } catch (e) {
        throw new Error(toUserMessage(e, '下班打卡失敗'))
      }
    },
    onSuccess: invalidate,
  })

  const assignSite = useMutation({
    mutationFn: async (input: { siteId: string; jobType?: JobType | string }) => {
      if (!userId) throw new Error('尚未登入')
      const siteId = input.siteId
      const jobType = (input.jobType as JobType | undefined) ?? 'project'
      try {
        if (!isBrowserOnline()) {
          enqueueOfflineOp({
            operationType: 'attendance_assign_site',
            payload: { userId, siteId, jobType },
          })
          notifyOfflineQueueChanged()
          if (!formal) {
            const open = localDb.getOpenAttendance(userId)
            if (!open) throw new Error('請先上班再選擇工地')
            const updated = { ...open, siteId, jobType }
            localDb.saveAttendance(updated)
            return updated
          }
          return {
            id: `pending-site-${crypto.randomUUID()}`,
            organizationId: '',
            userId,
            status: 'clocked_in' as const,
            clockInAt: new Date().toISOString(),
            siteId,
            jobType,
            note: '離線待驗證',
          }
        }
        if (formal) return await supabaseRepos.assignSite(userId, siteId)
        const open = localDb.getOpenAttendance(userId)
        if (!open) throw new Error('請先上班再選擇工地')
        const updated = { ...open, siteId, jobType }
        localDb.saveAttendance(updated)
        return updated
      } catch (e) {
        throw new Error(toUserMessage(e, '無法更新目前工地'))
      }
    },
    onSuccess: invalidate,
  })

  return {
    openShift: openQuery.data ?? null,
    history: historyQuery.data ?? [],
    isLoading: openQuery.isLoading,
    error: openQuery.error,
    clockIn: clockIn.mutateAsync,
    clockOut: clockOut.mutateAsync,
    assignSite: assignSite.mutateAsync,
    isClockingIn: clockIn.isPending,
    isClockingOut: clockOut.isPending,
    isAssigningSite: assignSite.isPending,
  }
}
