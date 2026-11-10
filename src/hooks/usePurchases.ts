import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  calcFinalPayable,
  isWithinEmergencyDailyLimit,
  isWithinEmergencySingleLimit,
} from '@/domain/rules'
import type { PurchaseMode } from '@/domain/types'
import { localDb } from '@/lib/localDb'

export const purchaseKeys = {
  all: ['purchases'] as const,
  list: (userId?: string) => [...purchaseKeys.all, 'list', userId ?? 'all'] as const,
  emergencyUsed: (userId: string) =>
    [...purchaseKeys.all, 'emergency-used', userId] as const,
}

export function usePurchases(userId: string | undefined) {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: purchaseKeys.list(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return []
      return localDb.getPurchases().filter((p) => p.userId === userId)
    },
  })

  const usedQuery = useQuery({
    queryKey: purchaseKeys.emergencyUsed(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return 0
      return localDb.emergencyUsedToday(userId)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      title: string
      mode: PurchaseMode
      siteId?: string
      goodsAmount: number
      discount?: number
      tax?: number
      shipping?: number
      otherBuyerFees?: number
    }) => {
      if (!userId) throw new Error('尚未登入')
      const finalPayable = calcFinalPayable(input)

      if (input.mode === 'emergency') {
        if (!isWithinEmergencySingleLimit(finalPayable)) {
          throw new Error('超過緊急採購單次上限 NT$5,000')
        }
        const used = localDb.emergencyUsedToday(userId)
        if (!isWithinEmergencyDailyLimit(used, finalPayable)) {
          throw new Error('超過緊急採購每日累計上限 NT$10,000')
        }
      }

      return localDb.createPurchase({ userId, ...input })
    },
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({ queryKey: purchaseKeys.list(userId) })
      void queryClient.invalidateQueries({
        queryKey: purchaseKeys.emergencyUsed(userId),
      })
    },
  })

  return {
    purchases: listQuery.data ?? [],
    emergencyUsedToday: usedQuery.data ?? 0,
    isLoading: listQuery.isLoading,
    createPurchase: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  }
}
