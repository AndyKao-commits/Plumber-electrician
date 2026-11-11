import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb INV-002 stock ledger', () => {
  it('transfer keeps org qty/cost; reserve reduces available; ledger immutable', () => {
    const b = boss()
    const mat = localDb.getMaterials()[0]
    const beforeCost = mat.unitCost
    const beforeQty = mat.qty
    const locs = localDb.listStockLocations()
    expect(locs.length).toBeGreaterThanOrEqual(2)
    const from = locs.find((l) => l.kind === 'warehouse')!
    const to = locs.find((l) => l.kind === 'site')!

    localDb.transferStock(
      { id: b.id },
      {
        materialId: mat.id,
        qty: 2,
        fromLocationId: from.id,
        toLocationId: to.id,
        clientOperationId: `t-${Date.now()}`,
      },
    )
    const afterXfer = localDb.getMaterials().find((m) => m.id === mat.id)!
    expect(afterXfer.qty).toBe(beforeQty)
    expect(afterXfer.unitCost).toBe(beforeCost)
    expect(
      localDb.listStockBalances(mat.id).find((x) => x.locationId === to.id)?.qty,
    ).toBeGreaterThanOrEqual(2)

    localDb.reserveStock(
      { id: b.id },
      {
        materialId: mat.id,
        qty: 3,
        locationId: from.id,
        clientOperationId: `r-${Date.now()}`,
      },
    )
    const afterReserve = localDb.getMaterials().find((m) => m.id === mat.id)!
    expect((afterReserve.reservedQty || 0) >= 3).toBe(true)
    expect((afterReserve.availableQty ?? afterReserve.qty) <= beforeQty - 3).toBe(
      true,
    )

    expect(() => localDb.updateStockMovement('x')).toThrow(/不可覆寫/)
    expect(() => localDb.deleteStockMovement('x')).toThrow(/不可刪除/)

    const movements = localDb.listStockMovements(mat.id)
    expect(movements.some((m) => m.movementType === 'transfer')).toBe(true)
    expect(movements.some((m) => m.movementType === 'reserve')).toBe(true)
  })
})
