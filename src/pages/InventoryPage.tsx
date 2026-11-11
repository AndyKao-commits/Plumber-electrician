import { useMemo, useState, type FormEvent } from 'react'
import { convertMaterialQty } from '@/domain/materialMaster'
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
    units,
    serials,
    inbound,
    isInbound,
    inboundError,
    createMaterial,
    isCreatingMaterial,
    createMaterialError,
    addUnit,
    isAddingUnit,
    registerSerial,
    isRegisteringSerial,
    registerSerialError,
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
  const [newSku, setNewSku] = useState('')
  const [newTracking, setNewTracking] = useState<'quantity' | 'serial'>(
    'quantity',
  )
  const [xferQty, setXferQty] = useState('1')
  const [fromLoc, setFromLoc] = useState('')
  const [toLoc, setToLoc] = useState('')
  const [reserveQty, setReserveQty] = useState('1')
  const [unitCode, setUnitCode] = useState('')
  const [unitLabel, setUnitLabel] = useState('')
  const [unitFactor, setUnitFactor] = useState('10')
  const [convFrom, setConvFrom] = useState('')
  const [convTo, setConvTo] = useState('')
  const [convQty, setConvQty] = useState('1')
  const [serialNo, setSerialNo] = useState('')
  const [serialCost, setSerialCost] = useState('0')

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

  const materialUnits = useMemo(
    () => units.filter((u) => u.materialId === selectedMaterialId),
    [units, selectedMaterialId],
  )

  const convertedQty = useMemo(() => {
    if (!selectedMaterialId || materialUnits.length < 2) return null
    const from =
      materialUnits.find((u) => u.code === convFrom) ||
      materialUnits.find((u) => u.isBase)
    const to =
      materialUnits.find((u) => u.code === convTo) ||
      materialUnits.find((u) => !u.isBase)
    if (!from || !to) return null
    try {
      return {
        from: from.code,
        to: to.code,
        value: convertMaterialQty({
          qty: Number(convQty) || 0,
          fromFactorToBase: from.factorToBase,
          toFactorToBase: to.factorToBase,
        }),
      }
    } catch {
      return null
    }
  }, [selectedMaterialId, materialUnits, convFrom, convTo, convQty])

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>材料主檔與庫存（INV-001／002）</strong>
        <p className="muted" style={{ margin: 0 }}>
          SKU／序號組織內唯一；單位依材料換算。可用量＝現存 − 預留；調撥≠耗用。
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
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              SKU {m.sku || '—'} ·{' '}
              {m.trackingMode === 'serial' ? '序號追蹤' : '數量追蹤'}
            </p>
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
            void createMaterial({
              name: newName,
              unit: newUnit,
              sku: newSku || newName.slice(0, 12),
              trackingMode: newTracking,
            }).then(() => {
              setNewName('')
              setNewUnit('式')
              setNewSku('')
              setNewTracking('quantity')
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
              <label htmlFor="mat-sku">SKU</label>
              <input
                id="mat-sku"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                placeholder="組織內唯一"
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="mat-unit">基本單位</label>
              <input
                id="mat-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="mat-track">追蹤模式</label>
              <select
                id="mat-track"
                value={newTracking}
                onChange={(e) =>
                  setNewTracking(e.target.value as 'quantity' | 'serial')
                }
              >
                <option value="quantity">數量（移動平均）</option>
                <option value="serial">序號（個別成本）</option>
              </select>
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
        <strong>單位換算</strong>
        <p className="muted" style={{ margin: 0 }}>
          選定材料的單位；換算經基本單位。
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="conv-from">從</label>
            <select
              id="conv-from"
              value={convFrom || materialUnits.find((u) => u.isBase)?.code || ''}
              onChange={(e) => setConvFrom(e.target.value)}
            >
              {materialUnits.map((u) => (
                <option key={u.id} value={u.code}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="conv-to">到</label>
            <select
              id="conv-to"
              value={
                convTo || materialUnits.find((u) => !u.isBase)?.code || ''
              }
              onChange={(e) => setConvTo(e.target.value)}
            >
              {materialUnits.map((u) => (
                <option key={u.id} value={u.code}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="conv-qty">數量</label>
          <input
            id="conv-qty"
            type="number"
            min="0"
            step="0.01"
            value={convQty}
            onChange={(e) => setConvQty(e.target.value)}
          />
        </div>
        {convertedQty ? (
          <p style={{ margin: 0 }}>
            {convQty} {convertedQty.from} ＝ {convertedQty.value}{' '}
            {convertedQty.to}
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            請先為材料設定兩個以上單位
          </p>
        )}
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedMaterialId) return
            void addUnit({
              materialId: selectedMaterialId,
              code: unitCode,
              label: unitLabel || unitCode,
              factorToBase: Number(unitFactor) || 0,
            }).then(() => {
              setUnitCode('')
              setUnitLabel('')
            })
          }}
        >
          <strong style={{ fontSize: '0.95rem' }}>新增換算單位</strong>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="unit-code">代碼</label>
              <input
                id="unit-code"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="unit-factor">＝幾基本單位</label>
              <input
                id="unit-factor"
                type="number"
                min="0.000001"
                step="any"
                value={unitFactor}
                onChange={(e) => setUnitFactor(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="unit-label">顯示名稱</label>
            <input
              id="unit-label"
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value)}
            />
          </div>
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={isAddingUnit || !unitCode.trim() || !selectedMaterialId}
          >
            {isAddingUnit ? '新增中…' : '新增單位'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>序號登錄</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedMaterialId) return
            void registerSerial({
              materialId: selectedMaterialId,
              serialNumber: serialNo,
              unitCost: Number(serialCost) || 0,
              locationId: defaultWh?.id,
            }).then(() => {
              setSerialNo('')
            })
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="serial-no">序號</label>
              <input
                id="serial-no"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="serial-cost">個別成本</label>
              <input
                id="serial-cost"
                type="number"
                min="0"
                step="0.01"
                value={serialCost}
                onChange={(e) => setSerialCost(e.target.value)}
              />
            </div>
          </div>
          {registerSerialError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(registerSerialError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-ghost"
            type="submit"
            disabled={
              isRegisteringSerial ||
              !serialNo.trim() ||
              materials.find((m) => m.id === selectedMaterialId)
                ?.trackingMode !== 'serial'
            }
          >
            {isRegisteringSerial ? '登錄中…' : '登錄序號入庫'}
          </button>
        </form>
        {serials.filter((s) => s.status === 'in_stock').length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            尚無在庫序號
          </p>
        ) : (
          serials
            .filter((s) => s.status === 'in_stock')
            .slice(0, 12)
            .map((s) => {
              const mat = materials.find((m) => m.id === s.materialId)
              return (
                <div key={s.id} className="row between">
                  <span>
                    {mat?.name || s.materialId} · {s.serialNumber}
                  </span>
                  <span className="muted">
                    NT${s.unitCost.toLocaleString()}
                  </span>
                </div>
              )
            })
        )}
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
