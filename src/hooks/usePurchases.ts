import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasPermission, PERMISSIONS } from '@/domain/permissions'
import {
  calcFinalPayable,
  isWithinEmergencyDailyLimit,
  isWithinEmergencySingleLimit,
} from '@/domain/rules'
import type { PurchaseMode } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { noticeKeys } from '@/hooks/useNotices'
import { useUser } from '@/hooks/useUser'

export const purchaseKeys = {
  all: ['purchases'] as const,
  list: (userId?: string) => [...purchaseKeys.all, 'list', userId ?? 'all'] as const,
  pending: ['purchases', 'pending'] as const,
  emergencyUsed: (userId: string) =>
    [...purchaseKeys.all, 'emergency-used', userId] as const,
}

export function usePurchases(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: purchaseKeys.list(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId || !user) return []
      try {
        if (formal) return await supabaseRepos.listPurchases(user)
        const all = localDb.getPurchases()
        return user.role === 'boss' ? all : all.filter((p) => p.userId === userId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入採購列表'))
      }
    },
  })

  const canApprove =
    Boolean(user) && hasPermission(user!.role, PERMISSIONS.PURCHASE_APPROVE)

  const pendingQuery = useQuery({
    queryKey: purchaseKeys.pending,
    enabled: Boolean(userId && user && canApprove),
    queryFn: async () => {
      if (!user) return []
      try {
        if (formal) return await supabaseRepos.listPendingPurchases(user)
        return localDb.getPurchases().filter((p) => p.status === 'pending_approval')
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入待核准採購'))
      }
    },
  })

  const usedQuery = useQuery({
    queryKey: purchaseKeys.emergencyUsed(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return 0
      try {
        return formal
          ? await supabaseRepos.emergencyUsedToday(userId)
          : localDb.emergencyUsedToday(userId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法讀取緊急額度'))
      }
    },
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: purchaseKeys.all })
    void queryClient.invalidateQueries({ queryKey: noticeKeys.all })
  }

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
      if (!userId || !user) throw new Error('尚未登入')
      const finalPayable = calcFinalPayable(input)
      if (input.mode === 'emergency') {
        if (!isWithinEmergencySingleLimit(finalPayable)) {
          throw new Error('超過緊急採購單次上限 NT$5,000')
        }
        const used = formal
          ? await supabaseRepos.emergencyUsedToday(userId)
          : localDb.emergencyUsedToday(userId)
        if (!isWithinEmergencyDailyLimit(used, finalPayable)) {
          throw new Error('超過緊急採購每日累計上限 NT$10,000')
        }
      }
      try {
        return formal
          ? await supabaseRepos.createPurchase(user, input)
          : localDb.createPurchase({ userId, ...input })
      } catch (e) {
        throw new Error(toUserMessage(e, '無法建立採購'))
      }
    },
    onSuccess: invalidate,
  })

  const approveMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      if (!user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.approvePurchase(user, purchaseId)
          : localDb.approvePurchase({ purchaseId, actorId: user.id })
      } catch (e) {
        throw new Error(toUserMessage(e, '核准失敗'))
      }
    },
    onSuccess: invalidate,
  })

  const rejectMutation = useMutation({
    mutationFn: async (input: { purchaseId: string; reason: string }) => {
      if (!user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.rejectPurchase(user, input.purchaseId, input.reason)
          : localDb.rejectPurchase({
              purchaseId: input.purchaseId,
              actorId: user.id,
              reason: input.reason,
            })
      } catch (e) {
        throw new Error(toUserMessage(e, '駁回失敗'))
      }
    },
    onSuccess: invalidate,
  })

  const cancelEmergencyMutation = useMutation({
    mutationFn: async (input: { purchaseId: string; reason: string }) => {
      if (!user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.cancelEmergencyPurchase(
              user,
              input.purchaseId,
              input.reason,
            )
          : localDb.cancelEmergencyPurchase({
              purchaseId: input.purchaseId,
              actorId: user.id,
              reason: input.reason,
            })
      } catch (e) {
        throw new Error(toUserMessage(e, '取消失敗'))
      }
    },
    onSuccess: invalidate,
  })

  const inboundMutation = useMutation({
    mutationFn: async (input: {
      purchaseId: string
      materialId: string
      qty: number
      unitCost?: number
    }) => {
      if (!user) throw new Error('尚未登入')
      if (!formal) throw new Error('本機示範模式請到庫存頁模擬入庫')
      return supabaseRepos.purchaseInbound(user, input)
    },
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  return {
    purchases: listQuery.data ?? [],
    pendingApprovals: pendingQuery.data ?? [],
    emergencyUsedToday: usedQuery.data ?? 0,
    isLoading: listQuery.isLoading,
    createPurchase: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    approvePurchase: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,
    rejectPurchase: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    rejectError: rejectMutation.error,
    cancelEmergency: cancelEmergencyMutation.mutateAsync,
    purchaseInbound: inboundMutation.mutateAsync,
    isInbound: inboundMutation.isPending,
    inboundError: inboundMutation.error
      ? new Error(toUserMessage(inboundMutation.error))
      : null,
  }
}
