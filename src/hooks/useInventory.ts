import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assertOnlineForOp } from '@/domain/offlineOps'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { isBrowserOnline } from '@/lib/offlineQueue'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const inventoryKeys = {
  all: ['inventory'] as const,
  locations: ['inventory', 'locations'] as const,
  movements: ['inventory', 'movements'] as const,
  reservations: ['inventory', 'reservations'] as const,
  balances: ['inventory', 'balances'] as const,
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

  const locationsQuery = useQuery({
    queryKey: inventoryKeys.locations,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listStockLocations()
          : localDb.listStockLocations()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入庫位'))
      }
    },
  })

  const movementsQuery = useQuery({
    queryKey: inventoryKeys.movements,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listStockMovements()
          : localDb.listStockMovements()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入流水帳'))
      }
    },
  })

  const reservationsQuery = useQuery({
    queryKey: inventoryKeys.reservations,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listStockReservations()
          : localDb.listStockReservations()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入預留'))
      }
    },
  })

  const balancesQuery = useQuery({
    queryKey: inventoryKeys.balances,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listStockBalances()
          : localDb.listStockBalances()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入庫位餘額'))
      }
    },
  })

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.locations })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.movements })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.reservations })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.balances })
  }

  const inboundMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      qty: number
      unitCost: number
      locationId?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('inventory_inbound', isBrowserOnline())
      try {
        return formal
          ? await supabaseRepos.inboundMaterial(user, input)
          : localDb.inboundMaterial({
              ...input,
              actorId: user.id,
              clientOperationId: `inbound-${crypto.randomUUID()}`,
            })
      } catch (e) {
        throw new Error(toUserMessage(e, '入庫失敗'))
      }
    },
    onSuccess: invalidateAll,
  })

  const createMaterialMutation = useMutation({
    mutationFn: async (input: { name: string; unit: string }) => {
      if (!user) throw new Error('尚未登入')
      if (!formal) throw new Error('本機示範模式不支援新增材料')
      return supabaseRepos.createMaterial(user, input)
    },
    onSuccess: invalidateAll,
  })

  const transferMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      qty: number
      fromLocationId: string
      toLocationId: string
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('inventory_transfer', isBrowserOnline())
      const clientOperationId = `transfer-${crypto.randomUUID()}`
      try {
        return formal
          ? await supabaseRepos.transferStock(user, {
              ...input,
              clientOperationId,
            })
          : localDb.transferStock(user, { ...input, clientOperationId })
      } catch (e) {
        throw new Error(toUserMessage(e, '調撥失敗'))
      }
    },
    onSuccess: invalidateAll,
  })

  const reserveMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      qty: number
      locationId?: string | null
      note?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('inventory_reserve', isBrowserOnline())
      const clientOperationId = `reserve-${crypto.randomUUID()}`
      try {
        return formal
          ? await supabaseRepos.reserveStock(user, {
              ...input,
              clientOperationId,
            })
          : localDb.reserveStock(user, { ...input, clientOperationId })
      } catch (e) {
        throw new Error(toUserMessage(e, '預留失敗'))
      }
    },
    onSuccess: invalidateAll,
  })

  const releaseMutation = useMutation({
    mutationFn: async (input: { reservationId: string }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('inventory_reserve', isBrowserOnline())
      const clientOperationId = `release-${crypto.randomUUID()}`
      try {
        return formal
          ? await supabaseRepos.releaseReservation(user, {
              ...input,
              clientOperationId,
            })
          : localDb.releaseReservation(user, { ...input, clientOperationId })
      } catch (e) {
        throw new Error(toUserMessage(e, '釋放預留失敗'))
      }
    },
    onSuccess: invalidateAll,
  })

  return {
    materials: listQuery.data ?? [],
    locations: locationsQuery.data ?? [],
    movements: movementsQuery.data ?? [],
    reservations: reservationsQuery.data ?? [],
    balances: balancesQuery.data ?? [],
    inbound: inboundMutation.mutateAsync,
    isInbound: inboundMutation.isPending,
    inboundError: inboundMutation.error,
    createMaterial: createMaterialMutation.mutateAsync,
    isCreatingMaterial: createMaterialMutation.isPending,
    createMaterialError: createMaterialMutation.error
      ? new Error(toUserMessage(createMaterialMutation.error))
      : null,
    transfer: transferMutation.mutateAsync,
    isTransfer: transferMutation.isPending,
    transferError: transferMutation.error,
    reserve: reserveMutation.mutateAsync,
    isReserve: reserveMutation.isPending,
    reserveError: reserveMutation.error,
    releaseReservation: releaseMutation.mutateAsync,
    isRelease: releaseMutation.isPending,
  }
}
