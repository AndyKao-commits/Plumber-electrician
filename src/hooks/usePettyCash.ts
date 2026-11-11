import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const pettyCashKeys = {
  all: ['petty-cash'] as const,
}

export function usePettyCash(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: pettyCashKeys.all })
  }

  const accountsQuery = useQuery({
    queryKey: [...pettyCashKeys.all, 'accounts'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listPettyCashAccounts()
          : localDb.listPettyCashAccounts()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入零用金帳戶'))
      }
    },
  })

  const requestsQuery = useQuery({
    queryKey: [...pettyCashKeys.all, 'requests'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listPettyCashRequests()
          : localDb.listPettyCashRequests()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入補充申請'))
      }
    },
  })

  const ledgerQuery = useQuery({
    queryKey: [...pettyCashKeys.all, 'ledger'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listPettyCashLedger()
          : localDb.listPettyCashLedger()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入零用金流水'))
      }
    },
  })

  const requestMutation = useMutation({
    mutationFn: async (input: {
      accountId: string
      amount: number
      reason: string
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.requestPettyCashTopUp(user, input)
        : localDb.requestPettyCashTopUp(user, input)
    },
    onSuccess: invalidate,
  })

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.approvePettyCashTopUp(user, requestId)
        : localDb.approvePettyCashTopUp(user, requestId)
    },
    onSuccess: invalidate,
  })

  const rejectMutation = useMutation({
    mutationFn: async (input: { requestId: string; reason: string }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.rejectPettyCashTopUp(user, input)
        : localDb.rejectPettyCashTopUp(user, input)
    },
    onSuccess: invalidate,
  })

  const disburseMutation = useMutation({
    mutationFn: async (input: { requestId: string; note?: string | null }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.disbursePettyCashTopUp(user, input)
        : localDb.disbursePettyCashTopUp(user, input)
    },
    onSuccess: invalidate,
  })

  return {
    accounts: accountsQuery.data ?? [],
    requests: requestsQuery.data ?? [],
    ledger: ledgerQuery.data ?? [],
    requestTopUp: requestMutation.mutateAsync,
    isRequesting: requestMutation.isPending,
    requestError: requestMutation.error,
    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    reject: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    disburse: disburseMutation.mutateAsync,
    isDisbursing: disburseMutation.isPending,
    disburseError: disburseMutation.error,
  }
}
