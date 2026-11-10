import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  RepairCaseStatus,
  WarrantyAssessmentClassification,
} from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const repairKeys = {
  all: ['repair-cases'] as const,
  assignments: (id: string) => ['repair-assignments', id] as const,
  visits: (id: string) => ['repair-visits', id] as const,
  warranties: ['warranties'] as const,
  assessments: (id: string) => ['warranty-assessments', id] as const,
}

export function useRepairs() {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: repairKeys.all,
    queryFn: async () => {
      try {
        if (formal) return supabaseRepos.listRepairCases()
        return localDb.getRepairCases()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入維修案件'))
      }
    },
  })

  function invalidate(caseId?: string) {
    void queryClient.invalidateQueries({ queryKey: repairKeys.all })
    if (caseId) {
      void queryClient.invalidateQueries({
        queryKey: repairKeys.assignments(caseId),
      })
      void queryClient.invalidateQueries({
        queryKey: repairKeys.visits(caseId),
      })
    }
  }

  const createRepair = useMutation({
    mutationFn: async (input: {
      problemDescription: string
      customerName?: string | null
      siteId?: string | null
      customerId?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createRepairCase(user, input)
        : localDb.createRepairCase({ id: user.id, name: user.name }, input)
    },
    onSuccess: () => invalidate(),
  })

  const assign = useMutation({
    mutationFn: async (input: {
      repairCaseId: string
      assigneeUserId: string
      assigneeName: string
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.assignRepair(user, input)
        : localDb.assignRepair({ id: user.id, name: user.name }, input)
    },
    onSuccess: (_d, v) => invalidate(v.repairCaseId),
  })

  const recordVisit = useMutation({
    mutationFn: async (input: {
      repairCaseId: string
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.recordRepairVisit(user, input)
        : localDb.recordRepairVisit({ id: user.id, name: user.name }, input)
    },
    onSuccess: (_d, v) => invalidate(v.repairCaseId),
  })

  const setStatus = useMutation({
    mutationFn: async (input: {
      repairCaseId: string
      status: RepairCaseStatus
    }) => {
      if (!user) throw new Error('尚未登入')
      if (formal) {
        await supabaseRepos.setRepairCaseStatus(
          user,
          input.repairCaseId,
          input.status,
        )
        return
      }
      localDb.setRepairCaseStatus(
        { id: user.id },
        input.repairCaseId,
        input.status,
      )
    },
    onSuccess: (_d, v) => invalidate(v.repairCaseId),
  })

  const warrantiesQuery = useQuery({
    queryKey: repairKeys.warranties,
    queryFn: async () => {
      try {
        if (formal) return supabaseRepos.listWarranties()
        return localDb.listWarranties()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入保固'))
      }
    },
  })

  const createWarranty = useMutation({
    mutationFn: async (input: {
      title: string
      siteId?: string | null
      repairCaseId?: string | null
      startsOn?: string | null
      endsOn?: string | null
      scopeNotes?: string | null
      exclusionNotes?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createWarranty(user, input)
        : localDb.createWarranty({ id: user.id }, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: repairKeys.warranties })
    },
  })

  const assessWarranty = useMutation({
    mutationFn: async (input: {
      repairCaseId: string
      warrantyId?: string | null
      classification: WarrantyAssessmentClassification
      rationale: string
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createWarrantyAssessment(user, input)
        : localDb.createWarrantyAssessment(
            { id: user.id, name: user.name },
            input,
          )
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({
        queryKey: repairKeys.assessments(v.repairCaseId),
      })
    },
  })

  return {
    repairs: listQuery.data ?? [],
    warranties: warrantiesQuery.data ?? [],
    isLoading: listQuery.isLoading,
    createRepair: createRepair.mutateAsync,
    assign: assign.mutateAsync,
    recordVisit: recordVisit.mutateAsync,
    setStatus: setStatus.mutateAsync,
    createWarranty: createWarranty.mutateAsync,
    assessWarranty: assessWarranty.mutateAsync,
    saving:
      createRepair.isPending ||
      assign.isPending ||
      recordVisit.isPending ||
      setStatus.isPending ||
      createWarranty.isPending ||
      assessWarranty.isPending,
  }
}

export function useRepairHistory(repairCaseId: string | undefined) {
  const formal = isFormalMode()
  const assignments = useQuery({
    queryKey: repairCaseId
      ? repairKeys.assignments(repairCaseId)
      : ['repair-assignments', 'none'],
    enabled: Boolean(repairCaseId),
    queryFn: async () => {
      if (!repairCaseId) return []
      if (formal) return supabaseRepos.listRepairAssignments(repairCaseId)
      return localDb.listRepairAssignments(repairCaseId)
    },
  })
  const visits = useQuery({
    queryKey: repairCaseId
      ? repairKeys.visits(repairCaseId)
      : ['repair-visits', 'none'],
    enabled: Boolean(repairCaseId),
    queryFn: async () => {
      if (!repairCaseId) return []
      if (formal) return supabaseRepos.listRepairVisits(repairCaseId)
      return localDb.listRepairVisits(repairCaseId)
    },
  })
  const assessments = useQuery({
    queryKey: repairCaseId
      ? repairKeys.assessments(repairCaseId)
      : ['warranty-assessments', 'none'],
    enabled: Boolean(repairCaseId),
    queryFn: async () => {
      if (!repairCaseId) return []
      if (formal) return supabaseRepos.listWarrantyAssessments(repairCaseId)
      return localDb.listWarrantyAssessments(repairCaseId)
    },
  })
  return {
    assignments: assignments.data ?? [],
    visits: visits.data ?? [],
    assessments: assessments.data ?? [],
    refetch: async () => {
      await Promise.all([
        assignments.refetch(),
        visits.refetch(),
        assessments.refetch(),
      ])
    },
  }
}
