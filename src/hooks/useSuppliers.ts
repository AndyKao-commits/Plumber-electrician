import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const supplierKeys = {
  all: ['suppliers'] as const,
}

export function useSuppliers(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: supplierKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listSuppliers()
          : localDb.listSuppliers()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入供應商'))
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string
      creditLimit?: number | null
      paymentTermsDays?: number
      notes?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createSupplier(user, input)
        : localDb.createSupplier(input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all })
    },
  })

  const linkMutation = useMutation({
    mutationFn: async (input: { purchaseId: string; supplierId: string }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.linkPurchaseSupplier(user, input)
        : localDb.linkPurchaseSupplier(input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['purchases'] })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.markPurchasePaid(user, purchaseId)
        : localDb.markPurchasePaid(purchaseId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['purchases'] })
    },
  })

  return {
    suppliers: listQuery.data ?? [],
    createSupplier: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    linkPurchase: linkMutation.mutateAsync,
    markPaid: markPaidMutation.mutateAsync,
    isMarkingPaid: markPaidMutation.isPending,
  }
}
