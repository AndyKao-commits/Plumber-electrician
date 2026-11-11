import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defaultOrgSpendSettings } from '@/domain/orgSpendSettings'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import type { AppUser } from '@/domain/types'

export const spendSettingsKeys = {
  all: ['orgSpendSettings'] as const,
  current: () => [...spendSettingsKeys.all, 'current'] as const,
}

export function useOrgSpendSettings(user?: AppUser | null) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const query = useQuery({
    queryKey: spendSettingsKeys.current(),
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return defaultOrgSpendSettings()
      if (formal) return supabaseRepos.getOrgSpendSettings(user)
      return localDb.getOrgSpendSettings()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: {
      reportReviewThresholdNtd: number
      emergencySingleLimitNtd: number
      emergencyDailyLimitNtd: number
      dailyPurchaseLimitNtd: number
    }) => {
      if (!user) throw new Error('尚未登入')
      if (formal) return supabaseRepos.updateOrgSpendSettings(user, input)
      return localDb.updateOrgSpendSettings(user, input)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: spendSettingsKeys.all }),
  })

  return {
    settings: query.data ?? defaultOrgSpendSettings(user?.organizationId),
    isLoading: query.isLoading,
    error: query.error ? new Error(toUserMessage(query.error)) : null,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error
      ? new Error(toUserMessage(updateMutation.error))
      : null,
  }
}
