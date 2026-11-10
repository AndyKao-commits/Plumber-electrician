import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { enqueueOfflineOp, isBrowserOnline } from '@/lib/offlineQueue'
import { notifyOfflineQueueChanged } from '@/lib/offlineSync'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const reportKeys = {
  all: ['reports'] as const,
  list: (siteId?: string) => [...reportKeys.all, 'list', siteId ?? 'all'] as const,
}

export function useReports(siteId?: string) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const listQuery = useQuery({
    queryKey: reportKeys.list(siteId),
    enabled: formal,
    queryFn: async () => supabaseRepos.listConstructionReports(siteId),
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      siteId: string
      body?: string
      photoUploadId?: string | null
    }) => {
      if (!isBrowserOnline()) {
        if (input.photoUploadId) {
          throw new Error('離線時無法附已上傳照片，請先只送文字回報，或恢復網路後再附圖')
        }
        const item = enqueueOfflineOp({
          operationType: 'construction_report',
          payload: {
            siteId: input.siteId,
            body: input.body ?? '',
            photoUploadId: null,
          },
        })
        notifyOfflineQueueChanged()
        return {
          queued: true as const,
          clientOperationId: item.clientOperationId,
        }
      }
      const report = await supabaseRepos.createConstructionReport(input)
      return { queued: false as const, report }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['photos'] })
    },
  })

  return {
    reports: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error ? new Error(toUserMessage(listQuery.error)) : null,
    createReport: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error
      ? new Error(toUserMessage(createMutation.error))
      : null,
  }
}
