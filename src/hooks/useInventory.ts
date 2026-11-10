import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const inventoryKeys = {
  all: ['inventory'] as const,
}

export function useInventory(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const listQuery = useQuery({
    queryKey: inventoryKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listMaterials(user ?? undefined)
          : localDb.getMaterials()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入庫存'))
      }
    },
  })

  const inboundMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      qty: number
      unitCost: number
    }) => {
      if (!user) throw new Error('尚未登入')
      try {
        return formal
          ? await supabaseRepos.inboundMaterial(user, input)
          : localDb.inboundMaterial(input)
      } catch (e) {
        throw new Error(toUserMessage(e, '入庫失敗'))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })

  const createMaterialMutation = useMutation({
    mutationFn: async (input: { name: string; unit: string }) => {
      if (!user) throw new Error('尚未登入')
      if (!formal) throw new Error('本機示範模式不支援新增材料')
      return supabaseRepos.createMaterial(user, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })

  return {
    materials: listQuery.data ?? [],
    inbound: inboundMutation.mutateAsync,
    isInbound: inboundMutation.isPending,
    inboundError: inboundMutation.error,
    createMaterial: createMaterialMutation.mutateAsync,
    isCreatingMaterial: createMaterialMutation.isPending,
    createMaterialError: createMaterialMutation.error
      ? new Error(toUserMessage(createMaterialMutation.error))
      : null,
  }
}
