import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assertOnlineForOp } from '@/domain/offlineOps'
import type {
  QuotationItemKind,
  QuoteExportFormat,
  QuoteWorkflowStatus,
  TaxMode,
} from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { isBrowserOnline } from '@/lib/offlineQueue'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const quoteKeys = {
  all: ['quotes'] as const,
  one: (id: string) => ['quotes', id] as const,
  items: (quoteId: string) => ['quote-items', quoteId] as const,
  versions: (quoteId: string) => ['quote-versions', quoteId] as const,
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
      customerName?: string
      siteAddress?: string
      paymentTerms?: string
      validUntil?: string | null
      notes?: string
      discount?: number
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

  return {
    quotes: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    repairCases: repairsQuery.data ?? [],
    createQuote: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    createRepairCase: createRepairMutation.mutateAsync,
    isCreatingRepair: createRepairMutation.isPending,
    createRepairError: createRepairMutation.error
      ? new Error(toUserMessage(createRepairMutation.error))
      : null,
  }
}

export function useQuoteDetail(quoteId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const quoteQuery = useQuery({
    queryKey: quoteId ? quoteKeys.one(quoteId) : ['quotes', 'none'],
    enabled: Boolean(quoteId),
    queryFn: async () => {
      if (!quoteId) return null
      try {
        return formal
          ? await supabaseRepos.getQuotation(quoteId)
          : localDb.getQuotation(quoteId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入報價案件'))
      }
    },
  })

  const itemsQuery = useQuery({
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

  const versionsQuery = useQuery({
    queryKey: quoteId ? quoteKeys.versions(quoteId) : ['quote-versions', 'none'],
    enabled: Boolean(quoteId),
    queryFn: async () => {
      if (!quoteId) return []
      try {
        return formal
          ? await supabaseRepos.listQuotationVersions(quoteId)
          : localDb.getQuotationVersions(quoteId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入版本'))
      }
    },
  })

  function invalidateAll() {
    if (!quoteId) return
    void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    void queryClient.invalidateQueries({ queryKey: quoteKeys.one(quoteId) })
    void queryClient.invalidateQueries({ queryKey: quoteKeys.items(quoteId) })
    void queryClient.invalidateQueries({
      queryKey: quoteKeys.versions(quoteId),
    })
  }

  const updateMeta = useMutation({
    mutationFn: async (
      patch: Parameters<typeof localDb.updateQuotationMeta>[1],
    ) => {
      if (!user || !quoteId) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      return formal
        ? supabaseRepos.updateQuotationMeta(user, quoteId, patch)
        : localDb.updateQuotationMeta(quoteId, patch)
    },
    onSuccess: invalidateAll,
  })

  const addItem = useMutation({
    mutationFn: async (input: {
      kind: QuotationItemKind
      description: string
      qty: number
      unit?: string
      unitPrice: number
    }) => {
      if (!user || !quoteId) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      return formal
        ? supabaseRepos.addQuotationItem(user, { quotationId: quoteId, ...input })
        : localDb.addQuotationItem({ quotationId: quoteId, ...input })
    },
    onSuccess: invalidateAll,
  })

  const updateItem = useMutation({
    mutationFn: async (input: {
      itemId: string
      patch: Parameters<typeof localDb.updateQuotationItem>[1]
    }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      return formal
        ? supabaseRepos.updateQuotationItem(user, input.itemId, input.patch)
        : localDb.updateQuotationItem(input.itemId, input.patch)
    },
    onSuccess: invalidateAll,
  })

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      if (formal) await supabaseRepos.removeQuotationItem(user, itemId)
      else localDb.removeQuotationItem(itemId)
    },
    onSuccess: invalidateAll,
  })

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!user || !quoteId) throw new Error('尚未登入')
      assertOnlineForOp('quote_create', isBrowserOnline())
      if (formal) {
        await supabaseRepos.reorderQuotationItems(user, quoteId, orderedIds)
      } else {
        localDb.reorderQuotationItems(quoteId, orderedIds)
      }
    },
    onSuccess: invalidateAll,
  })

  const exportVersion = useMutation({
    mutationFn: async (format: QuoteExportFormat = 'snapshot') => {
      if (!user || !quoteId) throw new Error('尚未登入')
      assertOnlineForOp('quote_publish', isBrowserOnline())
      return formal
        ? supabaseRepos.exportQuotationVersion(user, quoteId, format)
        : localDb.exportQuotationVersion(
            { id: user.id, role: user.role },
            quoteId,
            format,
          )
    },
    onSuccess: invalidateAll,
  })

  const setStatus = useMutation({
    mutationFn: async (workflowStatus: QuoteWorkflowStatus) => {
      if (!user || !quoteId) throw new Error('尚未登入')
      assertOnlineForOp('quote_publish', isBrowserOnline())
      return formal
        ? supabaseRepos.setQuoteWorkflowStatus(user, quoteId, workflowStatus)
        : localDb.setQuoteWorkflowStatus(
            { id: user.id, role: user.role },
            quoteId,
            workflowStatus,
          )
    },
    onSuccess: invalidateAll,
  })

  const softDeleteVersion = useMutation({
    mutationFn: async (input: { versionId: string; reason?: string }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('quote_publish', isBrowserOnline())
      try {
        if (formal) {
          await supabaseRepos.softDeleteQuotationVersion(
            user,
            input.versionId,
            input.reason,
          )
        } else {
          localDb.softDeleteQuotationVersion(
            { id: user.id, role: user.role },
            input.versionId,
            input.reason,
          )
        }
      } catch (e) {
        throw new Error(toUserMessage(e, '刪除版本失敗'))
      }
    },
    onSuccess: invalidateAll,
  })

  const softDeleteCase = useMutation({
    mutationFn: async (reason?: string) => {
      if (!user || !quoteId) throw new Error('尚未登入')
      assertOnlineForOp('quote_publish', isBrowserOnline())
      try {
        if (formal) {
          await supabaseRepos.softDeleteQuotation(user, quoteId, reason)
        } else {
          localDb.softDeleteQuotation(
            { id: user.id, role: user.role },
            quoteId,
            reason,
          )
        }
      } catch (e) {
        throw new Error(toUserMessage(e, '刪除案件失敗'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
      if (quoteId) {
        void queryClient.removeQueries({ queryKey: quoteKeys.one(quoteId) })
        void queryClient.removeQueries({ queryKey: quoteKeys.items(quoteId) })
        void queryClient.removeQueries({
          queryKey: quoteKeys.versions(quoteId),
        })
      }
    },
  })

  return {
    quote: quoteQuery.data ?? null,
    items: itemsQuery.data ?? [],
    versions: versionsQuery.data ?? [],
    isLoading: quoteQuery.isLoading || itemsQuery.isLoading,
    error: quoteQuery.error || itemsQuery.error,
    updateMeta: updateMeta.mutateAsync,
    addItem: addItem.mutateAsync,
    updateItem: updateItem.mutateAsync,
    removeItem: removeItem.mutateAsync,
    reorderItems: reorderItems.mutateAsync,
    exportVersion: exportVersion.mutateAsync,
    setStatus: setStatus.mutateAsync,
    softDeleteVersion: softDeleteVersion.mutateAsync,
    softDeleteCase: softDeleteCase.mutateAsync,
    saving:
      updateMeta.isPending ||
      addItem.isPending ||
      updateItem.isPending ||
      removeItem.isPending ||
      reorderItems.isPending ||
      exportVersion.isPending ||
      setStatus.isPending ||
      softDeleteVersion.isPending ||
      softDeleteCase.isPending,
  }
}
