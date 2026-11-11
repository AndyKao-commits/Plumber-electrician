import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SITE_STATUS_LABELS, isOpenSiteStatus } from '@/domain/siteStatus'
import type { ProjectKind } from '@/domain/types'
import { useSites } from '@/hooks/useSites'

type ListTab = 'open' | 'closed'

export function SitesPage() {
  const { sites, createSite, isCreating, isLoading } = useSites()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ProjectKind>('formal')
  const [address, setAddress] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<ListTab>('open')

  const openSites = useMemo(
    () => sites.filter((s) => isOpenSiteStatus(s.status)),
    [sites],
  )
  const closedSites = useMemo(
    () => sites.filter((s) => s.status === 'closed'),
    [sites],
  )
  const visible = tab === 'open' ? openSites : closedSites

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await createSite({ name, kind, address, customerName })
    setName('')
    setAddress('')
    setCustomerName('')
    setKind('formal')
    setShowForm(false)
    setTab('open')
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

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${tab === 'open' ? 'btn-steel' : 'btn-ghost'}`}
            onClick={() => setTab('open')}
          >
            進行中（{openSites.length}）
          </button>
          <button
            type="button"
            className={`btn ${tab === 'closed' ? 'btn-steel' : 'btn-ghost'}`}
            onClick={() => setTab('closed')}
          >
            已結案（{closedSites.length}）
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
          </form>
        ) : null}
      </section>

      <section className="stack">
        {isLoading ? <div className="empty">載入工地…</div> : null}
        {!isLoading && visible.length === 0 ? (
          <div className="panel empty">
            {tab === 'open' ? '尚無進行中工地。' : '尚無已結案工地。'}
          </div>
        ) : null}
        {visible.map((site) => (
          <Link key={site.id} className="site-link" to={`/sites/${site.id}`}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="badge steel">
                {site.kind === 'formal' ? '正式工程' : '臨時維修'}
              </span>
              <span className={`badge ${site.status === 'closed' ? '' : 'ok'}`}>
                {SITE_STATUS_LABELS[site.status]}
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
