import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DefectSeverity } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const defectKeys = {
  all: ['defects'] as const,
  site: (siteId: string) => [...defectKeys.all, siteId] as const,
}

export function useDefects(siteId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: defectKeys.site(siteId ?? 'none'),
    enabled: formal && Boolean(siteId),
    queryFn: async () => {
      if (!siteId) return []
      return supabaseRepos.listSiteDefects(siteId)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      title: string
      detail?: string
      severity?: DefectSeverity
    }) => {
      if (!siteId) throw new Error('缺少工地')
      return supabaseRepos.createSiteDefect({ siteId, ...input })
    },
    onSuccess: () => {
      if (!siteId) return
      void queryClient.invalidateQueries({ queryKey: defectKeys.site(siteId) })
    },
  })

  const advanceMutation = useMutation({
    mutationFn: async (input: {
      defectId: string
      action: 'fix' | 'reinspect' | 'close'
      note?: string
    }) => {
      if (!user) throw new Error('尚未登入')
      await supabaseRepos.advanceSiteDefect(user, input)
    },
    onSuccess: () => {
      if (!siteId) return
      void queryClient.invalidateQueries({ queryKey: defectKeys.site(siteId) })
    },
  })

  return {
    defects: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error ? new Error(toUserMessage(listQuery.error)) : null,
    createDefect: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error
      ? new Error(toUserMessage(createMutation.error))
      : null,
    advanceDefect: advanceMutation.mutateAsync,
    isAdvancing: advanceMutation.isPending,
  }
}
