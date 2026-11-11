import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const fieldFinanceKeys = {
  all: ['field-finance'] as const,
}

export function useFieldFinance(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: fieldFinanceKeys.all })
  }

  const expensesQuery = useQuery({
    queryKey: [...fieldFinanceKeys.all, 'expenses'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listExpenseReports(user!)
          : localDb.listExpenseReports()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入支出'))
      }
    },
  })

  const receiptsQuery = useQuery({
    queryKey: [...fieldFinanceKeys.all, 'receipts'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listCashReceipts(user!)
          : localDb.listCashReceipts()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入收款'))
      }
    },
  })

  const createExpense = useMutation({
    mutationFn: async (input: {
      siteId: string
      item: string
      amount: number
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createExpenseReport(user, input)
        : localDb.createExpenseReport(user, input)
    },
    onSuccess: invalidate,
  })

  const reviewExpense = useMutation({
    mutationFn: async (input: {
      id: string
      decision: 'confirm' | 'return' | 'cancel'
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.reviewExpenseReport(user, input)
        : localDb.reviewExpenseReport(user, input)
    },
    onSuccess: invalidate,
  })

  const createReceipt = useMutation({
    mutationFn: async (input: {
      siteId: string
      amount: number
      sourceNote?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createCashReceipt(user, input)
        : localDb.createCashReceipt(user, input)
    },
    onSuccess: invalidate,
  })

  const confirmReceipt = useMutation({
    mutationFn: async (input: {
      id: string
      decision: 'confirm' | 'return' | 'cancel'
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.confirmCashReceipt(user, input)
        : localDb.confirmCashReceipt(user, input)
    },
    onSuccess: invalidate,
  })

  return {
    expenses: expensesQuery.data ?? [],
    receipts: receiptsQuery.data ?? [],
    createExpense: createExpense.mutateAsync,
    isCreatingExpense: createExpense.isPending,
    createExpenseError: createExpense.error,
    reviewExpense: reviewExpense.mutateAsync,
    createReceipt: createReceipt.mutateAsync,
    isCreatingReceipt: createReceipt.isPending,
    createReceiptError: createReceipt.error,
    confirmReceipt: confirmReceipt.mutateAsync,
  }
}
