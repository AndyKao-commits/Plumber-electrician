import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectKind, SiteProject } from '@/domain/types'
import { localDb } from '@/lib/localDb'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const siteKeys = {
  all: ['sites'] as const,
  list: () => [...siteKeys.all, 'list'] as const,
  detail: (id: string) => [...siteKeys.all, 'detail', id] as const,
}

async function fetchSites(): Promise<SiteProject[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('sites')
      .select(
        'id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at',
      )
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      status: row.status,
      address: row.address ?? undefined,
      customerName: row.customer_name ?? undefined,
      notes: row.notes ?? undefined,
      warrantyUntil: row.warranty_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  return localDb.getSites()
}

async function createLocalSite(input: {
  name: string
  kind: ProjectKind
  address?: string
  customerName?: string
}): Promise<SiteProject> {
  const now = new Date().toISOString()
  const site: SiteProject = {
    id: `site-${crypto.randomUUID()}`,
    name: input.name.trim(),
    kind: input.kind,
    status: 'active',
    address: input.address?.trim() || undefined,
    customerName: input.customerName?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  localDb.upsertSite(site)
  return site
}

export function useSites() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: siteKeys.list(),
    queryFn: fetchSites,
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string
      kind: ProjectKind
      address?: string
      customerName?: string
    }) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('sites')
          .insert({
            name: input.name,
            kind: input.kind,
            address: input.address,
            customer_name: input.customerName,
            status: 'active',
          })
          .select(
            'id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at',
          )
          .single()
        if (error) throw error
        return {
          id: data.id,
          name: data.name,
          kind: data.kind,
          status: data.status,
          address: data.address ?? undefined,
          customerName: data.customer_name ?? undefined,
          notes: data.notes ?? undefined,
          warrantyUntil: data.warranty_until,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        } satisfies SiteProject
      }
      return createLocalSite(input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.list() })
    },
  })

  return {
    sites: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    createSite: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}

export function useSite(id: string | undefined) {
  return useQuery({
    queryKey: siteKeys.detail(id ?? 'missing'),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('sites')
          .select(
            'id, name, kind, status, address, customer_name, notes, warranty_until, created_at, updated_at',
          )
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!data) return null
        return {
          id: data.id,
          name: data.name,
          kind: data.kind,
          status: data.status,
          address: data.address ?? undefined,
          customerName: data.customer_name ?? undefined,
          notes: data.notes ?? undefined,
          warrantyUntil: data.warranty_until,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        } satisfies SiteProject
      }
      return localDb.getSite(id)
    },
  })
}
