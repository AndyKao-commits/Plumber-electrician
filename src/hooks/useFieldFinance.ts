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

  const advancesQuery = useQuery({
    queryKey: [...fieldFinanceKeys.all, 'advances'],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        if (formal) return await supabaseRepos.listEmployeeAdvances(user!)
        if (user?.role === 'boss') {
          return localDb.listEmployeeAdvances()
        }
        return localDb.listEmployeeAdvances({ employeeId: userId })
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入代墊'))
      }
    },
  })

  const createExpense = useMutation({
    mutationFn: async (input: {
      siteId?: string | null
      item: string
      amount: number
      note?: string | null
      locationText?: string | null
      misc?: boolean
      receiptPhotoPath?: string | null
      receiptFiles?: File[]
    }) => {
      if (!user) throw new Error('尚未登入')
      let receiptPhotoPath = input.receiptPhotoPath ?? null
      if (formal && input.receiptFiles?.length) {
        const paths: string[] = []
        for (const file of input.receiptFiles) {
          paths.push(
            await supabaseRepos.uploadReceiptPhoto({
              file,
              siteId: input.misc ? null : input.siteId,
            }),
          )
        }
        receiptPhotoPath = paths[0] ?? null
      } else if (!formal && input.receiptFiles?.length) {
        receiptPhotoPath = `local-receipt:${input.receiptFiles[0].name}`
      }
      const payload = {
        siteId: input.siteId,
        item: input.item,
        amount: input.amount,
        note: input.note,
        locationText: input.locationText,
        misc: input.misc,
        receiptPhotoPath,
      }
      return formal
        ? supabaseRepos.createExpenseReport(user, payload)
        : localDb.createExpenseReport(user, payload)
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
      siteId?: string | null
      amount: number
      sourceNote?: string | null
      locationText?: string | null
      misc?: boolean
      proofFiles?: File[]
    }) => {
      if (!user) throw new Error('尚未登入')
      let proofPhotoPath: string | null = null
      if (formal && input.proofFiles?.length) {
        proofPhotoPath = await supabaseRepos.uploadReceiptPhoto({
          file: input.proofFiles[0],
          siteId: input.misc ? null : input.siteId,
        })
      } else if (!formal && input.proofFiles?.length) {
        proofPhotoPath = `local-receipt:${input.proofFiles[0].name}`
      }
      const payload = {
        siteId: input.siteId,
        amount: input.amount,
        sourceNote: input.sourceNote,
        locationText: input.locationText,
        misc: input.misc,
        proofPhotoPath,
      }
      return formal
        ? supabaseRepos.createCashReceipt(user, payload)
        : localDb.createCashReceipt(user, payload)
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

  const createAdvance = useMutation({
    mutationFn: async (input: {
      siteId?: string | null
      item: string
      amount: number
      note?: string | null
      locationText?: string | null
      misc?: boolean
      receiptFiles?: File[]
    }) => {
      if (!user) throw new Error('尚未登入')
      let receiptPhotoPath: string | null = null
      if (formal && input.receiptFiles?.length) {
        receiptPhotoPath = await supabaseRepos.uploadReceiptPhoto({
          file: input.receiptFiles[0],
          siteId: input.misc ? null : input.siteId,
        })
      } else if (!formal && input.receiptFiles?.length) {
        receiptPhotoPath = `local-receipt:${input.receiptFiles[0].name}`
      }
      const payload = {
        siteId: input.siteId,
        item: input.item,
        amount: input.amount,
        note: input.note,
        locationText: input.locationText,
        misc: input.misc,
        receiptPhotoPath,
      }
      return formal
        ? supabaseRepos.createEmployeeAdvance(user, payload)
        : localDb.createEmployeeAdvance(user, payload)
    },
    onSuccess: invalidate,
  })

  const settleAdvances = useMutation({
    mutationFn: async (input: {
      advanceIds: string[]
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.batchSettleEmployeeAdvances(user, input)
        : localDb.batchSettleEmployeeAdvances(user, input)
    },
    onSuccess: invalidate,
  })

  return {
    expenses: expensesQuery.data ?? [],
    receipts: receiptsQuery.data ?? [],
    advances: advancesQuery.data ?? [],
    createExpense: createExpense.mutateAsync,
    isCreatingExpense: createExpense.isPending,
    createExpenseError: createExpense.error,
    reviewExpense: reviewExpense.mutateAsync,
    createReceipt: createReceipt.mutateAsync,
    isCreatingReceipt: createReceipt.isPending,
    createReceiptError: createReceipt.error,
    confirmReceipt: confirmReceipt.mutateAsync,
    createAdvance: createAdvance.mutateAsync,
    isCreatingAdvance: createAdvance.isPending,
    createAdvanceError: createAdvance.error,
    settleAdvances: settleAdvances.mutateAsync,
    isSettlingAdvances: settleAdvances.isPending,
    settleAdvancesError: settleAdvances.error,
  }
}
