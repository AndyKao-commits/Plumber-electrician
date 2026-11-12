import { Link } from 'react-router-dom'
import { useNotices } from '@/hooks/useNotices'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function NotificationsPage() {
  const { user } = useUser()
  const {
    notices,
    markRead,
    complete,
    deleteNotice,
    clearReadNotices,
    readCount,
    isClearingRead,
    isDeleting,
  } = useNotices(user?.id)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
          <strong>通知中心</strong>
          {readCount > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isClearingRead}
              onClick={() => {
                if (!window.confirm(`清除 ${readCount} 則已讀通知？`)) return
                void clearReadNotices().catch(() => undefined)
              }}
            >
              {isClearingRead ? '清除中…' : '清除已讀'}
            </button>
          ) : null}
        </div>
      </section>

      <section className="stack">
        {notices.length === 0 ? (
          <div className="panel empty">目前沒有通知</div>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="panel stack">
              <div className="row between">
                <span className="badge steel">
                  {notice.kind === 'todo' ? '待辦' : '通知'}
                </span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {formatTaipei(notice.createdAt, 'MM/dd HH:mm')}
                </span>
              </div>
              <strong>{notice.title}</strong>
              <p className="muted" style={{ margin: 0 }}>
                {notice.detail}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {notice.unread ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void markRead(notice.id)}
                  >
                    標為已讀
                  </button>
                ) : (
                  <span className="badge ok">已讀</span>
                )}
                {notice.kind === 'todo' && notice.status === 'open' ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void complete(notice.id)}
                  >
                    完成待辦
                  </button>
                ) : null}
                {notice.href ? (
                  <Link className="btn btn-ghost" to={notice.href}>
                    開啟
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={isDeleting}
                  onClick={() => {
                    if (!window.confirm('刪除此通知？')) return
                    void deleteNotice(notice.id).catch(() => undefined)
                  }}
                >
                  刪除
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
