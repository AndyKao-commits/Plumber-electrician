import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb INV-001 material master', () => {
  it('unit conversion and unique serials', () => {
    const b = boss()
    const pipe = localDb.getMaterials().find((m) => m.sku === 'PVC-4')!
    expect(
      localDb.convertMaterialQtyFor(pipe.id, 2, '箱', '支'),
    ).toBe(40)

    const pump = localDb.getMaterials().find((m) => m.trackingMode === 'serial')!
    expect(() =>
      localDb.registerMaterialSerial(
        { id: b.id, organizationId: b.organizationId },
        {
          materialId: pump.id,
          serialNumber: 'PUMP-SEED-001',
          unitCost: 1,
        },
      ),
    ).toThrow(/序號組織內必須唯一/)

    const created = localDb.registerMaterialSerial(
      { id: b.id, organizationId: b.organizationId },
      {
        materialId: pump.id,
        serialNumber: `PUMP-${Date.now()}`,
        unitCost: 9000,
      },
    )
    expect(created.status).toBe('in_stock')
    expect(created.unitCost).toBe(9000)

    expect(() =>
      localDb.createLocalMaterial(
        { id: b.id, organizationId: b.organizationId },
        { name: 'dup', unit: '支', sku: 'PVC-4' },
      ),
    ).toThrow(/SKU 組織內必須唯一/)
  })
})
