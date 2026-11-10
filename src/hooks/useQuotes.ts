import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TaxMode } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const quoteKeys = {
  all: ['quotes'] as const,
}

export function useQuotes(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: quoteKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listQuotations()
          : localDb.getQuotations()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入報價'))
      }
    },
  })

  const repairsQuery = useQuery({
    queryKey: ['repair-cases'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listRepairCases()
          : localDb.getRepairCases()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入維修案件'))
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      title: string
      projectId?: string | null
      repairCaseId?: string | null
      taxMode: TaxMode
      amountBeforeTax: number
    }) => {
      if (!userId || !user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.createQuotation(user, input)
          : localDb.createQuotation({ createdBy: userId, ...input })
      } catch (e) {
        throw new Error(toUserMessage(e, '無法建立報價'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      if (!user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.publishQuotation(user, quoteId)
          : localDb.publishQuotation(quoteId)
      } catch (e) {
        throw new Error(toUserMessage(e, '發布報價失敗'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    },
  })

  return {
    quotes: listQuery.data ?? [],
    repairCases: repairsQuery.data ?? [],
    createQuote: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    publishQuote: publishMutation.mutateAsync,
  }
}
