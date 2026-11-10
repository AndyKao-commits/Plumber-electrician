import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AttendanceRecord, JobType } from '@/domain/types'
import { localDb } from '@/lib/localDb'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { userKeys } from './useUser'

export const attendanceKeys = {
  all: ['attendance'] as const,
  open: (userId: string) => [...attendanceKeys.all, 'open', userId] as const,
  history: (userId: string) =>
    [...attendanceKeys.all, 'history', userId] as const,
}

async function getPosition(): Promise<{
  latitude: number | null
  longitude: number | null
}> {
  if (!('geolocation' in navigator)) {
    return { latitude: null, longitude: null }
  }

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

  const openQuery = useQuery({
    queryKey: attendanceKeys.open(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AttendanceRecord | null> => {
      if (!userId) return null
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('attendance')
          .select(
            'id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
          )
          .eq('user_id', userId)
          .eq('status', 'clocked_in')
          .maybeSingle()
        if (error) throw error
        if (!data) return null
        return {
          id: data.id,
          userId: data.user_id,
          status: data.status,
          clockInAt: data.clock_in_at,
          clockOutAt: data.clock_out_at,
          siteId: data.site_id,
          jobType: data.job_type,
          latitude: data.latitude,
          longitude: data.longitude,
          note: data.note,
        }
      }
      return localDb.getOpenAttendance(userId)
    },
  })

  const historyQuery = useQuery({
    queryKey: attendanceKeys.history(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AttendanceRecord[]> => {
      if (!userId) return []
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('attendance')
          .select(
            'id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
          )
          .eq('user_id', userId)
          .order('clock_in_at', { ascending: false })
          .limit(30)
        if (error) throw error
        return (data ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          status: row.status,
          clockInAt: row.clock_in_at,
          clockOutAt: row.clock_out_at,
          siteId: row.site_id,
          jobType: row.job_type,
          latitude: row.latitude,
          longitude: row.longitude,
          note: row.note,
        }))
      }
      return localDb
        .getAttendance()
        .filter((a) => a.userId === userId)
        .slice(0, 30)
    },
  })

  const clockInMutation = useMutation({
    mutationFn: async (input?: { siteId?: string; jobType?: JobType }) => {
      if (!userId) throw new Error('尚未登入')
      const pos = await getPosition()
      const now = new Date().toISOString()

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('attendance')
          .insert({
            user_id: userId,
            status: 'clocked_in',
            clock_in_at: now,
            site_id: input?.siteId ?? null,
            job_type: input?.jobType ?? null,
            latitude: pos.latitude,
            longitude: pos.longitude,
          })
          .select(
            'id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
          )
          .single()
        if (error) throw error
        return {
          id: data.id,
          userId: data.user_id,
          status: data.status,
          clockInAt: data.clock_in_at,
          clockOutAt: data.clock_out_at,
          siteId: data.site_id,
          jobType: data.job_type,
          latitude: data.latitude,
          longitude: data.longitude,
          note: data.note,
        } satisfies AttendanceRecord
      }

      const open = localDb.getOpenAttendance(userId)
      if (open) throw new Error('已經在上班中，請先下班或補登工地')

      const record: AttendanceRecord = {
        id: `att-${crypto.randomUUID()}`,
        userId,
        status: 'clocked_in',
        clockInAt: now,
        siteId: input?.siteId ?? null,
        jobType: input?.jobType ?? null,
        latitude: pos.latitude,
        longitude: pos.longitude,
      }
      localDb.saveAttendance(record)
      return record
    },
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.open(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.history(userId),
      })
      void queryClient.invalidateQueries({ queryKey: userKeys.me() })
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('尚未登入')
      const now = new Date().toISOString()

      if (isSupabaseConfigured && supabase) {
        const open = openQuery.data
        if (!open) throw new Error('目前沒有進行中的打卡')
        const { data, error } = await supabase
          .from('attendance')
          .update({ status: 'clocked_out', clock_out_at: now })
          .eq('id', open.id)
          .select(
            'id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
          )
          .single()
        if (error) throw error
        return {
          id: data.id,
          userId: data.user_id,
          status: data.status,
          clockInAt: data.clock_in_at,
          clockOutAt: data.clock_out_at,
          siteId: data.site_id,
          jobType: data.job_type,
          latitude: data.latitude,
          longitude: data.longitude,
          note: data.note,
        } satisfies AttendanceRecord
      }

      const open = localDb.getOpenAttendance(userId)
      if (!open) throw new Error('目前沒有進行中的打卡')
      const closed: AttendanceRecord = {
        ...open,
        status: 'clocked_out',
        clockOutAt: now,
      }
      localDb.saveAttendance(closed)
      return closed
    },
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.open(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.history(userId),
      })
    },
  })

  const assignSiteMutation = useMutation({
    mutationFn: async (input: { siteId: string; jobType?: JobType }) => {
      if (!userId) throw new Error('尚未登入')
      const open = openQuery.data ?? localDb.getOpenAttendance(userId)
      if (!open) throw new Error('請先上班打卡，再補登工地')

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('attendance')
          .update({
            site_id: input.siteId,
            job_type: input.jobType ?? open.jobType ?? 'project',
          })
          .eq('id', open.id)
          .select(
            'id, user_id, status, clock_in_at, clock_out_at, site_id, job_type, latitude, longitude, note',
          )
          .single()
        if (error) throw error
        return {
          id: data.id,
          userId: data.user_id,
          status: data.status,
          clockInAt: data.clock_in_at,
          clockOutAt: data.clock_out_at,
          siteId: data.site_id,
          jobType: data.job_type,
          latitude: data.latitude,
          longitude: data.longitude,
          note: data.note,
        } satisfies AttendanceRecord
      }

      const updated: AttendanceRecord = {
        ...open,
        siteId: input.siteId,
        jobType: input.jobType ?? open.jobType ?? 'project',
      }
      localDb.saveAttendance(updated)
      return updated
    },
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.open(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.history(userId),
      })
    },
  })

  return {
    openShift: openQuery.data ?? null,
    history: historyQuery.data ?? [],
    isLoading: openQuery.isLoading || historyQuery.isLoading,
    clockIn: clockInMutation.mutateAsync,
    clockOut: clockOutMutation.mutateAsync,
    assignSite: assignSiteMutation.mutateAsync,
    isClockingIn: clockInMutation.isPending,
    isClockingOut: clockOutMutation.isPending,
    isAssigningSite: assignSiteMutation.isPending,
  }
}
