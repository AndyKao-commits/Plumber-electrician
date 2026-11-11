import { useState, type FormEvent } from 'react'
import { STOCK_MOVEMENT_LABELS } from '@/domain/stockLedger'
import { useInventory } from '@/hooks/useInventory'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function InventoryPage() {
  const { user } = useUser()
  const {
    materials,
    locations,
    movements,
    reservations,
    balances,
    inbound,
    isInbound,
    inboundError,
    createMaterial,
    isCreatingMaterial,
    createMaterialError,
    transfer,
    isTransfer,
    transferError,
    reserve,
    isReserve,
    reserveError,
    releaseReservation,
    isRelease,
  } = useInventory(user?.id)
  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState('10')
  const [unitCost, setUnitCost] = useState('50')
  const [formError, setFormError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('式')
  const [xferQty, setXferQty] = useState('1')
  const [fromLoc, setFromLoc] = useState('')
  const [toLoc, setToLoc] = useState('')
  const [reserveQty, setReserveQty] = useState('1')

  const selectedMaterialId =
    materialId && materials.some((m) => m.id === materialId)
      ? materialId
      : (materials[0]?.id ?? '')

  const defaultWh =
    locations.find((l) => l.isDefault) ||
    locations.find((l) => l.kind === 'warehouse')
  const fromLocationId =
    fromLoc && locations.some((l) => l.id === fromLoc)
      ? fromLoc
      : (defaultWh?.id ?? '')
  const toLocationId =
    toLoc && locations.some((l) => l.id === toLoc)
      ? toLoc
      : (locations.find((l) => l.id !== fromLocationId)?.id ?? '')

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
      locationId: defaultWh?.id,
    })
  }

  const locName = (id: string | null | undefined) =>
    locations.find((l) => l.id === id)?.name || id || '—'

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>庫存流水帳（INV-002）</strong>
        <p className="muted" style={{ margin: 0 }}>
          可用量＝現存 − 有效預留。倉庫↔工地調撥不計耗用、不重算成本；正式流水帳不可覆寫。
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
              現存 {m.qty} · 預留 {m.reservedQty ?? 0} · 可用{' '}
              {m.availableQty ?? m.qty} · 單位成本 NT$
              {m.unitCost.toLocaleString()}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              庫位{' '}
              {balances
                .filter((b) => b.materialId === m.id && b.qty > 0)
                .map((b) => `${locName(b.locationId)} ${b.qty}`)
                .join(' · ') || '—'}
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

      <section className="panel stack">
        <strong>庫位調撥（≠耗用）</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedMaterialId || !fromLocationId || !toLocationId) return
            void transfer({
              materialId: selectedMaterialId,
              qty: Number(xferQty) || 0,
              fromLocationId,
              toLocationId,
            })
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="xfer-from">來源庫位</label>
              <select
                id="xfer-from"
                value={fromLocationId}
                onChange={(e) => setFromLoc(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="xfer-to">目的庫位</label>
              <select
                id="xfer-to"
                value={toLocationId}
                onChange={(e) => setToLoc(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="xfer-qty">數量</label>
            <input
              id="xfer-qty"
              type="number"
              min="1"
              step="1"
              value={xferQty}
              onChange={(e) => setXferQty(e.target.value)}
            />
          </div>
          {transferError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(transferError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={
              isTransfer ||
              materials.length === 0 ||
              locations.length < 2 ||
              fromLocationId === toLocationId
            }
          >
            {isTransfer ? '調撥中…' : '確認調撥'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>預留／釋放</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedMaterialId) return
            void reserve({
              materialId: selectedMaterialId,
              qty: Number(reserveQty) || 0,
              locationId: fromLocationId || defaultWh?.id,
            })
          }}
        >
          <div className="field">
            <label htmlFor="rsv-qty">預留數量（占用可用量）</label>
            <input
              id="rsv-qty"
              type="number"
              min="1"
              step="1"
              value={reserveQty}
              onChange={(e) => setReserveQty(e.target.value)}
            />
          </div>
          {reserveError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(reserveError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={isReserve || materials.length === 0}
          >
            {isReserve ? '預留中…' : '建立預留'}
          </button>
        </form>
        {reservations.filter((r) => r.status === 'active').length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            尚無有效預留
          </p>
        ) : (
          reservations
            .filter((r) => r.status === 'active')
            .map((r) => {
              const mat = materials.find((m) => m.id === r.materialId)
              return (
                <div key={r.id} className="row between">
                  <span>
                    {mat?.name || r.materialId} · {r.qty} ·{' '}
                    {locName(r.locationId)}
                  </span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={isRelease}
                    onClick={() =>
                      void releaseReservation({ reservationId: r.id })
                    }
                  >
                    釋放
                  </button>
                </div>
              )
            })
        )}
      </section>

      <section className="panel stack">
        <strong>流水帳</strong>
        {movements.length === 0 ? (
          <div className="empty">尚無過帳紀錄</div>
        ) : (
          movements.slice(0, 20).map((mv) => (
            <div key={mv.id} className="site-link">
              <div className="row between">
                <strong>{STOCK_MOVEMENT_LABELS[mv.movementType]}</strong>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {formatTaipei(mv.postedAt, 'MM/dd HH:mm')}
                </span>
              </div>
              <p style={{ margin: 0 }}>
                {mv.materialName} · {mv.qty}
                {mv.movementType === 'transfer'
                  ? ` · ${locName(mv.fromLocationId)} → ${locName(mv.toLocationId)}`
                  : null}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
