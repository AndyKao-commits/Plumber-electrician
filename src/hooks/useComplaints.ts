import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ComplaintStatus } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const complaintKeys = {
  all: ['complaints'] as const,
  related: (id: string) => ['related-repairs', id] as const,
}

export function useComplaints() {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: complaintKeys.all,
    queryFn: async () => {
      try {
        if (formal) return supabaseRepos.listComplaints()
        return localDb.listComplaints()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入客訴'))
      }
    },
  })

  const createComplaint = useMutation({
    mutationFn: async (input: {
      subject: string
      detail?: string | null
      siteId?: string | null
      repairCaseId?: string | null
      customerName?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createComplaint(user, input)
        : localDb.createComplaint({ id: user.id }, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: complaintKeys.all })
    },
  })

  const setStatus = useMutation({
    mutationFn: async (input: {
      complaintId: string
      status: ComplaintStatus
    }) => {
      if (!user) throw new Error('尚未登入')
      if (formal) {
        await supabaseRepos.setComplaintStatus(
          user,
          input.complaintId,
          input.status,
        )
        return
      }
      localDb.setComplaintStatus(
        { id: user.id },
        input.complaintId,
        input.status,
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: complaintKeys.all })
    },
  })

  const linkRelated = useMutation({
    mutationFn: async (input: {
      fromRepairCaseId: string
      toRepairCaseId: string
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.linkRelatedRepairCases(user, input)
        : localDb.linkRelatedRepairCases({ id: user.id }, input)
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({
        queryKey: complaintKeys.related(v.fromRepairCaseId),
      })
      void queryClient.invalidateQueries({
        queryKey: complaintKeys.related(v.toRepairCaseId),
      })
    },
  })

  return {
    complaints: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    createComplaint: createComplaint.mutateAsync,
    setStatus: setStatus.mutateAsync,
    linkRelated: linkRelated.mutateAsync,
    saving:
      createComplaint.isPending ||
      setStatus.isPending ||
      linkRelated.isPending,
  }
}
