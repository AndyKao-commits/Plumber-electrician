import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assertOnlineForOp } from '@/domain/offlineOps'
import type { QuotationItemKind, TaxMode } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { isBrowserOnline } from '@/lib/offlineQueue'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const quoteKeys = {
  all: ['quotes'] as const,
  items: (quoteId: string) => ['quote-items', quoteId] as const,
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
      amountBeforeTax?: number
    }) => {
      if (!userId || !user) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
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
      assertOnlineForOp('quote_publish', isBrowserOnline())
      try {
        return formal
          ? await supabaseRepos.publishQuotation(user, quoteId)
          : localDb.publishQuotation(quoteId, user.role)
      } catch (e) {
        throw new Error(toUserMessage(e, '發布報價失敗'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    },
  })

  const acceptMutation = useMutation({
    mutationFn: async (input: { quoteId: string; note?: string }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('quote_publish', isBrowserOnline())
      try {
        return formal
          ? await supabaseRepos.acceptQuotation(
              user,
              input.quoteId,
              input.note,
            )
          : localDb.acceptQuotation(
              input.quoteId,
              { id: user.id, role: user.role },
              input.note,
            )
      } catch (e) {
        throw new Error(toUserMessage(e, '登記接受失敗'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    },
  })

  const createRepairMutation = useMutation({
    mutationFn: async (input: {
      title: string
      customerName: string
      siteId?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      if (!formal) throw new Error('本機示範模式請使用既有維修案件')
      return supabaseRepos.createRepairCase(user, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repair-cases'] })
    },
  })

  const addItemMutation = useMutation({
    mutationFn: async (input: {
      quotationId: string
      kind: QuotationItemKind
      description: string
      qty: number
      unit?: string
      unitPrice: number
    }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      try {
        return formal
          ? await supabaseRepos.addQuotationItem(user, input)
          : localDb.addQuotationItem(input)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法新增報價細項'))
      }
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
      void queryClient.invalidateQueries({
        queryKey: quoteKeys.items(vars.quotationId),
      })
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: async (input: { itemId: string; quotationId: string }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      try {
        if (formal) await supabaseRepos.removeQuotationItem(user, input.itemId)
        else localDb.removeQuotationItem(input.itemId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法刪除報價細項'))
      }
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
      void queryClient.invalidateQueries({
        queryKey: quoteKeys.items(vars.quotationId),
      })
    },
  })

  return {
    quotes: listQuery.data ?? [],
    repairCases: repairsQuery.data ?? [],
    createQuote: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    publishQuote: publishMutation.mutateAsync,
    acceptQuote: acceptMutation.mutateAsync,
    createRepairCase: createRepairMutation.mutateAsync,
    isCreatingRepair: createRepairMutation.isPending,
    createRepairError: createRepairMutation.error
      ? new Error(toUserMessage(createRepairMutation.error))
      : null,
    addQuoteItem: addItemMutation.mutateAsync,
    removeQuoteItem: removeItemMutation.mutateAsync,
    isSavingItem: addItemMutation.isPending || removeItemMutation.isPending,
  }
}

export function useQuoteItems(quoteId: string | undefined) {
  const formal = isFormalMode()
  return useQuery({
    queryKey: quoteId ? quoteKeys.items(quoteId) : ['quote-items', 'none'],
    enabled: Boolean(quoteId),
    queryFn: async () => {
      if (!quoteId) return []
      try {
        return formal
          ? await supabaseRepos.listQuotationItems(quoteId)
          : localDb.getQuotationItems(quoteId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入報價細項'))
      }
    },
  })
}
