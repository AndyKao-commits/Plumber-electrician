import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  PayType,
  SalaryEntryCategory,
  SalaryEntryStatus,
} from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const salaryKeys = {
  all: ['salary'] as const,
  settings: (userId?: string) => [...salaryKeys.all, 'settings', userId] as const,
  entries: (year: number, month: number, userId?: string) =>
    [...salaryKeys.all, 'entries', year, month, userId ?? 'all'] as const,
  attendance: (userId: string, year: number, month: number) =>
    [...salaryKeys.all, 'attendance', userId, year, month] as const,
}

export function useSalaryPeriod(year: number, month: number, userId?: string) {
  const formal = isFormalMode()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const targetUserId = userId ?? user?.id

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: salaryKeys.all })
  }

  const settingsQuery = useQuery({
    queryKey: salaryKeys.settings(targetUserId),
    enabled: Boolean(user && targetUserId),
    queryFn: async () => {
      if (!user || !targetUserId) return null
      try {
        return formal
          ? await supabaseRepos.getEmployeePaySetting(user, targetUserId)
          : localDb.getEmployeePaySetting(targetUserId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入薪資設定'))
      }
    },
  })

  const entriesQuery = useQuery({
    queryKey: salaryKeys.entries(year, month, targetUserId),
    enabled: Boolean(user && targetUserId),
    queryFn: async () => {
      if (!user || !targetUserId) return []
      try {
        return formal
          ? await supabaseRepos.listSalaryEntries(user, {
              year,
              month,
              userId: targetUserId,
            })
          : localDb.listSalaryEntries({ year, month, userId: targetUserId })
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入薪資明細'))
      }
    },
  })

  const allEntriesQuery = useQuery({
    queryKey: salaryKeys.entries(year, month, 'all'),
    enabled: Boolean(user && user.role === 'boss'),
    queryFn: async () => {
      if (!user) return []
      try {
        return formal
          ? await supabaseRepos.listSalaryEntries(user, { year, month })
          : localDb.listSalaryEntries({ year, month })
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入全員薪資'))
      }
    },
  })

  const attendanceQuery = useQuery({
    queryKey: salaryKeys.attendance(targetUserId || '', year, month),
    enabled: Boolean(user && targetUserId),
    queryFn: async () => {
      if (!user || !targetUserId) return []
      try {
        return formal
          ? await supabaseRepos.listAttendanceForMonth(user, {
              userId: targetUserId,
              year,
              month,
            })
          : localDb.listAttendanceForMonth(targetUserId, year, month)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入出勤'))
      }
    },
  })

  const upsertSetting = useMutation({
    mutationFn: async (input: {
      userId: string
      payType: PayType
      baseAmount: number
      effectiveFrom: string
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.upsertEmployeePaySetting(user, input)
        : localDb.upsertEmployeePaySetting(user, input)
    },
    onSuccess: invalidate,
  })

  const createEntry = useMutation({
    mutationFn: async (input: {
      userId: string
      userName: string
      entryDate: string
      category: SalaryEntryCategory
      amount: number
      title: string
      note?: string | null
      siteId?: string | null
      siteName?: string | null
      status?: SalaryEntryStatus
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createSalaryEntry(user, input)
        : localDb.createSalaryEntry(user, input)
    },
    onSuccess: invalidate,
  })

  const updateEntryStatus = useMutation({
    mutationFn: async (input: {
      id: string
      status: 'confirmed' | 'paid' | 'cancelled' | 'pending'
      reason?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.updateSalaryEntryStatus(user, input)
        : localDb.updateSalaryEntryStatus(user, input)
    },
    onSuccess: invalidate,
  })

  const correctEntry = useMutation({
    mutationFn: async (input: {
      id: string
      amount: number
      title?: string
      note?: string | null
      reason: string
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.correctSalaryEntry(user, input)
        : localDb.correctSalaryEntry(user, input)
    },
    onSuccess: invalidate,
  })

  return {
    setting: settingsQuery.data ?? null,
    entries: entriesQuery.data ?? [],
    allEntries: allEntriesQuery.data ?? [],
    attendance: attendanceQuery.data ?? [],
    isLoading:
      settingsQuery.isLoading ||
      entriesQuery.isLoading ||
      attendanceQuery.isLoading,
    upsertSetting: upsertSetting.mutateAsync,
    createEntry: createEntry.mutateAsync,
    updateEntryStatus: updateEntryStatus.mutateAsync,
    correctEntry: correctEntry.mutateAsync,
    isSaving:
      upsertSetting.isPending ||
      createEntry.isPending ||
      updateEntryStatus.isPending ||
      correctEntry.isPending,
  }
}
