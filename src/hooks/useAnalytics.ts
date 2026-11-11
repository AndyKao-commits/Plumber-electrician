import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sumIssuedBillingAmount } from '@/domain/billing'
import {
  assertCanExportOpsStats,
  buildOpsStatsCsv,
  computeOpsStats,
} from '@/domain/analytics'
import { sumConfirmedPayments } from '@/domain/payments'
import { sumConfirmedRefunds } from '@/domain/refunds'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'
import { roundMoney } from '@/domain/money'

export function useAnalytics() {
  const formal = isFormalMode()
  const { user } = useUser()

  const query = useQuery({
    queryKey: ['ops-analytics', formal],
    enabled: Boolean(user),
    queryFn: async () => {
      try {
        if (formal) {
          const [quotes, repairs, complaints, usages] = await Promise.all([
            supabaseRepos.listQuotations(),
            supabaseRepos.listRepairCases(),
            supabaseRepos.listComplaints(),
            supabaseRepos.listMaterialUsages(),
          ])
          let billed = 0
          let cashIn = 0
          let refunds = 0
          for (const q of quotes) {
            const [docs, pays, refs] = await Promise.all([
              supabaseRepos.listBillingDocuments(q.id),
              supabaseRepos.listCustomerPayments(q.id),
              supabaseRepos.listCustomerRefunds(q.id),
            ])
            billed = roundMoney(billed + sumIssuedBillingAmount(docs))
            cashIn = roundMoney(cashIn + sumConfirmedPayments(pays))
            refunds = roundMoney(refunds + sumConfirmedRefunds(refs))
          }
          return {
            issuedBillingTotal: billed,
            confirmedPaymentsTotal: cashIn,
            confirmedRefundsTotal: refunds,
            confirmedUsageCostTotal: usages.reduce(
              (s, u) => roundMoney(s + u.totalCost),
              0,
            ),
            openRepairs: repairs.filter((r) => r.status !== 'closed' && r.status !== 'cancelled').length,
            closedRepairs: repairs.filter((r) => r.status === 'closed').length,
            openComplaints: complaints.filter((c) => c.status === 'open').length,
            escalatedComplaints: complaints.filter((c) => c.status === 'escalated')
              .length,
          }
        }

        const quotes = localDb.getQuotations()
        let billed = 0
        let cashIn = 0
        let refunds = 0
        for (const q of quotes) {
          billed = roundMoney(
            billed + sumIssuedBillingAmount(localDb.listBillingDocuments(q.id)),
          )
          cashIn = roundMoney(
            cashIn + sumConfirmedPayments(localDb.listCustomerPayments(q.id)),
          )
          refunds = roundMoney(
            refunds + sumConfirmedRefunds(localDb.listCustomerRefunds(q.id)),
          )
        }
        const repairs = localDb.getRepairCases()
        const complaints = localDb.listComplaints()
        const usages = localDb.listMaterialUsages()
        return {
          issuedBillingTotal: billed,
          confirmedPaymentsTotal: cashIn,
          confirmedRefundsTotal: refunds,
          confirmedUsageCostTotal: usages.reduce(
            (s, u) => roundMoney(s + u.totalCost),
            0,
          ),
          openRepairs: repairs.filter(
            (r) => r.status !== 'closed' && r.status !== 'cancelled',
          ).length,
          closedRepairs: repairs.filter((r) => r.status === 'closed').length,
          openComplaints: complaints.filter((c) => c.status === 'open').length,
          escalatedComplaints: complaints.filter((c) => c.status === 'escalated')
            .length,
        }
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入營運統計'))
      }
    },
  })

  const stats = useMemo(() => {
    if (!query.data || !user) return null
    return computeOpsStats(query.data, {
      role: user.role,
      financeAuthorized: user.financeAuthorized,
    })
  }, [query.data, user])

  function exportCsv(): string {
    if (!user || !stats) throw new Error('尚無統計資料')
    assertCanExportOpsStats(user.role, Boolean(user.financeAuthorized))
    return buildOpsStatsCsv(stats)
  }

  return {
    stats,
    isLoading: query.isLoading,
    error: query.error,
    exportCsv,
  }
}
