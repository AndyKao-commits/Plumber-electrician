import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { localDb } from '@/lib/localDb'

export const inventoryKeys = {
  all: ['inventory'] as const,
}

export function useInventory(userId: string | undefined) {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: inventoryKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => localDb.getMaterials(),
  })

  const inboundMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      qty: number
      unitCost: number
    }) => localDb.inboundMaterial(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })

  return {
    materials: listQuery.data ?? [],
    inbound: inboundMutation.mutateAsync,
    isInbound: inboundMutation.isPending,
    inboundError: inboundMutation.error,
  }
}
