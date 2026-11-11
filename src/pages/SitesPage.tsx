import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ProjectKind } from '@/domain/types'
import { useSites } from '@/hooks/useSites'

export function SitesPage() {
  const { sites, createSite, isCreating, isLoading } = useSites()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ProjectKind>('formal')
  const [address, setAddress] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await createSite({ name, kind, address, customerName })
    setName('')
    setAddress('')
    setCustomerName('')
    setKind('formal')
    setShowForm(false)
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>工地／案件</strong>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '取消' : '新增'}
          </button>
        </div>

        {showForm ? (
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="site-name">工地／案件名稱</label>
              <input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：忠孝東路住家整修"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="site-kind">類型</label>
              <select
                id="site-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as ProjectKind)}
              >
                <option value="formal">正式工程</option>
                <option value="repair">臨時維修</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="site-customer">客戶</label>
              <input
                id="site-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="客戶名稱"
              />
            </div>
            <div className="field">
              <label htmlFor="site-address">地址</label>
              <input
                id="site-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="工地地址"
              />
            </div>
            <button className="btn btn-steel btn-block" type="submit" disabled={isCreating}>
              {isCreating ? '建立中…' : '建立工地'}
            </button>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              建立後可在詳情指派師傅、彙整日誌與上傳照片。
            </p>
          </form>
        ) : null}
      </section>

      <section className="stack">
        {isLoading ? <div className="empty">載入工地…</div> : null}
        {!isLoading && sites.length === 0 ? (
          <div className="panel empty">尚無工地，先新增第一個案件。</div>
        ) : null}
        {sites.map((site) => (
          <Link key={site.id} className="site-link" to={`/sites/${site.id}`}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="badge steel">
                {site.kind === 'formal' ? '正式工程' : '臨時維修'}
              </span>
              <span className="badge ok">
                {site.status === 'active'
                  ? '進行中'
                  : site.status === 'pending_close'
                    ? '待結案'
                    : site.status}
              </span>
            </div>
            <h3>{site.name}</h3>
            <p>
              {[site.customerName, site.address].filter(Boolean).join(' · ') ||
                '尚未填寫客戶或地址'}
            </p>
          </Link>
        ))}
      </section>
    </div>
  )
}
