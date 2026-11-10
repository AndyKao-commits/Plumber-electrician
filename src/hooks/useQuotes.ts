import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TaxMode } from '@/domain/types'
import { localDb } from '@/lib/localDb'

export const quoteKeys = {
  all: ['quotes'] as const,
}

export function useQuotes(userId: string | undefined) {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: quoteKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => localDb.getQuotations(),
  })

  const repairsQuery = useQuery({
    queryKey: ['repair-cases'],
    enabled: Boolean(userId),
    queryFn: async () => localDb.getRepairCases(),
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      title: string
      projectId?: string | null
      repairCaseId?: string | null
      taxMode: TaxMode
      amountBeforeTax: number
    }) => {
      if (!userId) throw new Error('尚未登入')
      return localDb.createQuotation({ createdBy: userId, ...input })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (quoteId: string) => localDb.publishQuotation(quoteId),
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
