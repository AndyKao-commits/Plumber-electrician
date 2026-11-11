import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectKind, SiteProject } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const siteKeys = {
  all: ['sites'] as const,
  list: () => [...siteKeys.all, 'list'] as const,
  detail: (id: string) => [...siteKeys.all, 'detail', id] as const,
}

function createLocalSite(input: {
  name: string
  kind: ProjectKind
  address?: string
  customerName?: string
}): SiteProject {
  const now = new Date().toISOString()
  const site: SiteProject = {
    id: `site-${crypto.randomUUID()}`,
    organizationId: localDb.orgId,
    name: input.name.trim(),
    kind: input.kind,
    status: 'active',
    address: input.address?.trim() || undefined,
    customerName: input.customerName?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
  localDb.upsertSite(site)
  return site
}

export function useSites() {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: siteKeys.list(),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listSites(user ?? undefined)
          : localDb.getSites(user ?? null)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入工地列表'))
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string
      kind: ProjectKind
      address?: string
      customerName?: string
    }) => {
      if (formal && !user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.createSite(user!, input)
          : createLocalSite(input)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法建立工地'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.all })
    },
  })

  return {
    sites: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    createSite: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  }
}

export function useSite(id: string | undefined) {
  const formal = isFormalMode()
  const { user } = useUser()
  return useQuery({
    queryKey: siteKeys.detail(id ?? 'missing'),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      try {
        if (formal) {
          return await supabaseRepos.getSite(id, user ?? undefined)
        }
        const site = localDb.getSite(id)
        if (!site || !user) return site
        const visible = localDb.getSites(user).some((s) => s.id === id)
        return visible ? site : null
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入工地'))
      }
    },
  })
}
