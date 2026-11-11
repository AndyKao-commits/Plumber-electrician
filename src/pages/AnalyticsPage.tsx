import { useAnalytics } from '@/hooks/useAnalytics'
import { useUser } from '@/hooks/useUser'

export function AnalyticsPage() {
  const { user } = useUser()
  const { stats, isLoading, error, exportCsv } = useAnalytics()

  function onExport() {
    try {
      const csv = exportCsv()
      const blob = new Blob([`\uFEFF${csv}`], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ops-stats-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : '匯出失敗')
    }
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>營運統計（ANA-001）</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              只統計已確認／已開立事件；成本依權限遮罩；不認列收入。
              {user ? `（${user.role}）` : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-steel"
            onClick={onExport}
            disabled={!stats}
          >
            匯出 CSV
          </button>
        </div>

        {isLoading ? <p className="muted">載入中…</p> : null}
        {error ? (
          <p style={{ color: 'var(--danger)' }}>
            {error instanceof Error ? error.message : '載入失敗'}
          </p>
        ) : null}

        {stats ? (
          <p style={{ margin: 0 }}>
            已請款 NT${stats.billed.toLocaleString()}
            <br />
            淨現金 NT${stats.netCash.toLocaleString()}（收款{' '}
            {stats.cashIn.toLocaleString()} − 退款{' '}
            {stats.cashOutRefunds.toLocaleString()}）
            <br />
            耗用成本{' '}
            {stats.costVisible
              ? `NT$${(stats.usageCost ?? 0).toLocaleString()}`
              : '（無權限遮罩）'}
            <br />
            維修：進行中 {stats.openRepairs} · 已結案 {stats.closedRepairs}
            <br />
            客訴：待處理 {stats.openComplaints} · 已升級{' '}
            {stats.escalatedComplaints}
            <br />
            <span className="muted">認列收入：政策未決（不顯示）</span>
          </p>
        ) : null}
      </section>
    </div>
  )
}
