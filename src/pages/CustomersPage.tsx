import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { customersSharingSite } from '@/domain/crm'
import { useCustomerContacts, useCustomers } from '@/hooks/useCustomers'
import { useSites } from '@/hooks/useSites'
export function CustomersPage() {
  const { sites } = useSites()
  const {
    customers,
    links,
    isLoading,
    createCustomer,
    addContact,
    linkSite,
    saving,
  } = useCustomers()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [linkSiteId, setLinkSiteId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const contactsQuery = useCustomerContacts(selectedId ?? undefined)
  const selected = customers.find((c) => c.id === selectedId) ?? null
  const selectedLinks = useMemo(
    () => links.filter((l) => l.customerId === selectedId),
    [links, selectedId],
  )

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const c = await createCustomer({
        name,
        phone: phone || null,
        notes: notes || null,
      })
      setName('')
      setPhone('')
      setNotes('')
      setShowForm(false)
      setSelectedId(c.id)
      setMessage('已建立客戶（僅名稱即可）')
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗')
    }
  }

  async function onAddContact(e: FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setError(null)
    try {
      await addContact({
        customerId: selectedId,
        name: contactName,
        phone: contactPhone || null,
        isPrimary: (contactsQuery.data?.length ?? 0) === 0,
      })
      setContactName('')
      setContactPhone('')
      setMessage('已新增聯絡人')
      void contactsQuery.refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增聯絡人失敗')
    }
  }

  async function onLinkSite(e: FormEvent) {
    e.preventDefault()
    if (!selectedId || !linkSiteId) return
    setError(null)
    try {
      await linkSite({ customerId: selectedId, siteId: linkSiteId })
      const peers = customersSharingSite(linkSiteId, [
        ...links,
        { customerId: selectedId, siteId: linkSiteId },
      ])
      setMessage(
        peers.length > 1
          ? `已關聯地址（同址共 ${peers.length} 位客戶）`
          : '已關聯地址',
      )
      setLinkSiteId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '關聯失敗')
    }
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>客戶主檔</strong>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '取消' : '新增客戶'}
          </button>
        </div>

        {showForm ? (
          <form className="stack" onSubmit={(e) => void onCreate(e)}>
            <div className="field">
              <label>客戶名稱（必填）</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：王太太"
                required
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>電話（選填）</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="field">
                <label>備註（選填）</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn-steel" type="submit" disabled={saving}>
              建立客戶
            </button>
          </form>
        ) : null}

        {message ? (
          <p style={{ color: 'var(--ok, #0a7a3e)', margin: 0 }}>{message}</p>
        ) : null}
        {error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        ) : null}
      </section>

      <section className="stack">
        {isLoading ? <div className="empty">載入客戶…</div> : null}
        {!isLoading && customers.length === 0 ? (
          <div className="empty">尚無客戶，可只填名稱建立。</div>
        ) : null}
        {customers.map((c) => {
          const siteCount = links.filter((l) => l.customerId === c.id).length
          return (
            <button
              key={c.id}
              type="button"
              className="panel"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                borderColor:
                  selectedId === c.id ? 'var(--accent, #2a6)' : undefined,
              }}
              onClick={() => setSelectedId(c.id)}
            >
              <strong>{c.name}</strong>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {c.phone ? `${c.phone} · ` : ''}
                地址關聯 {siteCount}
              </p>
            </button>
          )
        })}
      </section>

      {selected ? (
        <section className="panel stack">
          <strong>{selected.name}</strong>
          {selected.notes ? (
            <p className="muted" style={{ margin: 0 }}>
              {selected.notes}
            </p>
          ) : null}

          <div className="stack">
            <strong>聯絡人</strong>
            {(contactsQuery.data ?? []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無聯絡人
              </p>
            ) : (
              (contactsQuery.data ?? []).map((ct) => (
                <p key={ct.id} style={{ margin: 0 }}>
                  {ct.name}
                  {ct.isPrimary ? '（主要）' : ''}
                  {ct.phone ? ` · ${ct.phone}` : ''}
                </p>
              ))
            )}
            <form className="stack" onSubmit={(e) => void onAddContact(e)}>
              <div className="grid-2">
                <div className="field">
                  <label>聯絡人</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>電話</label>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-ghost" type="submit" disabled={saving}>
                新增聯絡人
              </button>
            </form>
          </div>

          <div className="stack">
            <strong>地址關聯（可多人同址）</strong>
            {selectedLinks.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚未關聯工地／地址
              </p>
            ) : (
              selectedLinks.map((l) => {
                const site = sites.find((s) => s.id === l.siteId)
                const peers = customersSharingSite(l.siteId, links).length
                return (
                  <p key={l.id} style={{ margin: 0 }}>
                    <Link to={`/sites/${l.siteId}`}>
                      {site?.name ?? l.siteId}
                    </Link>
                    {site?.address ? ` · ${site.address}` : ''}
                    {peers > 1 ? ` · 同址 ${peers} 客戶` : ''}
                  </p>
                )
              })
            )}
            <form className="stack" onSubmit={(e) => void onLinkSite(e)}>
              <div className="field">
                <label>選擇工地／地址</label>
                <select
                  value={linkSiteId}
                  onChange={(e) => setLinkSiteId(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.address ? `（${s.address}）` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-ghost" type="submit" disabled={saving}>
                關聯地址
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
