import { useState, type FormEvent } from 'react'
import { useInventory } from '@/hooks/useInventory'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function InventoryPage() {
  const { user } = useUser()
  const {
    materials,
    inbound,
    isInbound,
    inboundError,
    createMaterial,
    isCreatingMaterial,
    createMaterialError,
  } = useInventory(user?.id)
  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState('10')
  const [unitCost, setUnitCost] = useState('50')
  const [formError, setFormError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('式')

  const selectedMaterialId =
    materialId && materials.some((m) => m.id === materialId)
      ? materialId
      : (materials[0]?.id ?? '')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!selectedMaterialId) {
      setFormError('尚無材料可入庫')
      return
    }
    await inbound({
      materialId: selectedMaterialId,
      qty: Number(qty) || 0,
      unitCost: Number(unitCost) || 0,
    })
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>庫存成本（移動加權平均）</strong>
        <p className="muted" style={{ margin: 0 }}>
          成本池＝組織＋材料（REV-06）。一般採購入庫才更新平均成本；零庫存再入庫採新批成本。
        </p>
      </section>

      <section className="panel stack">
        <strong>材料現況</strong>
        {materials.length === 0 ? <div className="empty">尚無材料</div> : null}
        {materials.map((m) => (
          <div key={m.id} className="site-link">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{m.name}</h3>
              <span className="badge">{m.unit}</span>
            </div>
            <p>
              數量 {m.qty} · 單位成本 NT${m.unitCost.toLocaleString()}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              更新 {formatTaipei(m.updatedAt, 'MM/dd HH:mm')}
            </p>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <strong>新增材料</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void createMaterial({ name: newName, unit: newUnit }).then(() => {
              setNewName('')
              setNewUnit('式')
            })
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="mat-name">名稱</label>
              <input
                id="mat-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="mat-unit">單位</label>
              <input
                id="mat-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                required
              />
            </div>
          </div>
          {createMaterialError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {createMaterialError.message}
            </p>
          ) : null}
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={isCreatingMaterial || !newName.trim()}
          >
            {isCreatingMaterial ? '建立中…' : '建立材料'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>入庫</strong>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label htmlFor="inv-mat">材料</label>
            <select
              id="inv-mat"
              value={selectedMaterialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
              disabled={materials.length === 0}
            >
              {materials.length === 0 ? <option value="">尚無材料</option> : null}
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="inv-qty">數量</label>
              <input
                id="inv-qty"
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-cost">入庫單價</label>
              <input
                id="inv-cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
          </div>
          {formError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
          ) : null}
          {inboundError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(inboundError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel btn-block"
            type="submit"
            disabled={isInbound || materials.length === 0}
          >
            {isInbound ? '入庫中…' : '入庫並重算平均成本'}
          </button>
        </form>
      </section>
    </div>
  )
}
