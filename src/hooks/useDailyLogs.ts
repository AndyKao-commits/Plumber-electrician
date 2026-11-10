import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const dailyLogKeys = {
  all: ['daily-logs'] as const,
  site: (siteId: string) => [...dailyLogKeys.all, siteId] as const,
  versions: (logId: string) => [...dailyLogKeys.all, 'versions', logId] as const,
}

export function useDailyLogs(siteId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: dailyLogKeys.site(siteId ?? 'none'),
    enabled: formal && Boolean(siteId),
    queryFn: async () => {
      if (!siteId) return []
      return supabaseRepos.listDailyLogs(siteId)
    },
  })

  const invalidate = () => {
    if (!siteId) return
    void queryClient.invalidateQueries({ queryKey: dailyLogKeys.site(siteId) })
  }

  const ensureDraft = useMutation({
    mutationFn: async (logDate?: string) => {
      if (!user || !siteId) throw new Error('尚未登入或缺少工地')
      return supabaseRepos.ensureDailyLogDraft(user, siteId, logDate)
    },
    onSuccess: invalidate,
  })

  const saveBody = useMutation({
    mutationFn: async (input: { logId: string; body: string }) => {
      if (!user) throw new Error('尚未登入')
      return supabaseRepos.updateDailyLogBody(user, input.logId, input.body)
    },
    onSuccess: invalidate,
  })

  const publish = useMutation({
    mutationFn: async (logId: string) => {
      if (!user) throw new Error('尚未登入')
      return supabaseRepos.publishDailyLog(user, logId)
    },
    onSuccess: invalidate,
  })

  return {
    logs: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error ? new Error(toUserMessage(listQuery.error)) : null,
    ensureDraft: ensureDraft.mutateAsync,
    isEnsuring: ensureDraft.isPending,
    ensureError: ensureDraft.error
      ? new Error(toUserMessage(ensureDraft.error))
      : null,
    saveBody: saveBody.mutateAsync,
    isSaving: saveBody.isPending,
    publish: publish.mutateAsync,
    isPublishing: publish.isPending,
    publishError: publish.error ? new Error(toUserMessage(publish.error)) : null,
  }
}
