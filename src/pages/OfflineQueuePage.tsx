import { OFFLINE_OP_LABELS } from '@/domain/offlineOps'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { formatTaipei } from '@/lib/time'

const STATUS_LABEL: Record<string, string> = {
  pending: '待同步',
  syncing: '同步中',
  synced: '已同步',
  failed: '失敗',
  conflict: '衝突',
}

export function OfflineQueuePage() {
  const { online, items, pendingCount, flushing, flush, lastResult } =
    useOfflineQueue()

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>離線佇列</strong>
        <p className="muted" style={{ margin: 0 }}>
          允許離線暫存：施工回報、待辦、出勤（待驗證）。採購核准、庫存入庫、報價發布必須連線。
          恢復網路後會自動同步；同操作識別碼重送會去重（INT-10）。
        </p>
        <div className="row between">
          <span className={`badge ${online ? 'ok' : ''}`}>
            {online ? '已連線' : '離線'}
          </span>
          <span className="muted">待同步 {pendingCount} 筆</span>
        </div>
        <button
          type="button"
          className="btn btn-steel btn-block"
          disabled={!online || flushing || pendingCount === 0}
          onClick={() => void flush()}
        >
          {flushing ? '同步中…' : '立即同步'}
        </button>
        {lastResult ? (
          <p className="muted" style={{ margin: 0 }}>
            上次：處理 {lastResult.processed}、成功 {lastResult.synced}、失敗{' '}
            {lastResult.failed}、衝突 {lastResult.conflict}
          </p>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>佇列內容</strong>
        {items.length === 0 ? (
          <div className="empty">目前沒有離線草稿</div>
        ) : (
          items
            .slice()
            .reverse()
            .map((item) => (
              <div key={item.clientOperationId} className="site-link">
                <div className="row between">
                  <span
                    className={`badge ${item.status === 'synced' ? 'ok' : ''}`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                  <span className="muted">
                    {formatTaipei(item.createdAt, 'MM/dd HH:mm')}
                  </span>
                </div>
                <p style={{ marginTop: 8 }}>
                  {OFFLINE_OP_LABELS[item.operationType] ?? item.operationType}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  id {item.clientOperationId.slice(0, 8)}… · 嘗試{' '}
                  {item.attempts} 次
                </p>
                {item.lastError ? (
                  <p style={{ color: 'var(--danger)', margin: '6px 0 0' }}>
                    {item.lastError}
                  </p>
                ) : null}
              </div>
            ))
        )}
      </section>
    </div>
  )
}
