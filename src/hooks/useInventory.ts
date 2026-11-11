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
  units: ['inventory', 'units'] as const,
  serials: ['inventory', 'serials'] as const,
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

  const unitsQuery = useQuery({
    queryKey: inventoryKeys.units,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listMaterialUnits()
          : localDb.listMaterialUnits()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入單位'))
      }
    },
  })

  const serialsQuery = useQuery({
    queryKey: inventoryKeys.serials,
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return formal
          ? await supabaseRepos.listMaterialSerials()
          : localDb.listMaterialSerials()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入序號'))
      }
    },
  })

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.locations })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.movements })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.reservations })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.balances })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.units })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.serials })
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
    mutationFn: async (input: {
      name: string
      unit: string
      sku?: string
      trackingMode?: 'quantity' | 'serial'
    }) => {
      if (!user) throw new Error('尚未登入')
      if (formal) return supabaseRepos.createMaterial(user, input)
      return localDb.createLocalMaterial(
        { id: user.id, organizationId: user.organizationId },
        {
          name: input.name,
          unit: input.unit,
          sku: input.sku || input.name.slice(0, 12),
          trackingMode: input.trackingMode,
        },
      )
    },
    onSuccess: invalidateAll,
  })

  const addUnitMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      code: string
      label: string
      factorToBase: number
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.addMaterialUnit(user, input)
        : localDb.addMaterialUnit(
            { id: user.id, organizationId: user.organizationId },
            input,
          )
    },
    onSuccess: invalidateAll,
  })

  const registerSerialMutation = useMutation({
    mutationFn: async (input: {
      materialId: string
      serialNumber: string
      unitCost: number
      locationId?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      assertOnlineForOp('inventory_inbound', isBrowserOnline())
      return formal
        ? supabaseRepos.registerMaterialSerial(user, input)
        : localDb.registerMaterialSerial(
            { id: user.id, organizationId: user.organizationId },
            input,
          )
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
    units: unitsQuery.data ?? [],
    serials: serialsQuery.data ?? [],
    inbound: inboundMutation.mutateAsync,
    isInbound: inboundMutation.isPending,
    inboundError: inboundMutation.error,
    createMaterial: createMaterialMutation.mutateAsync,
    isCreatingMaterial: createMaterialMutation.isPending,
    createMaterialError: createMaterialMutation.error
      ? new Error(toUserMessage(createMaterialMutation.error))
      : null,
    addUnit: addUnitMutation.mutateAsync,
    isAddingUnit: addUnitMutation.isPending,
    registerSerial: registerSerialMutation.mutateAsync,
    isRegisteringSerial: registerSerialMutation.isPending,
    registerSerialError: registerSerialMutation.error,
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
