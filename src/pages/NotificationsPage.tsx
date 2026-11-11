import { Link } from 'react-router-dom'
import { useNotices } from '@/hooks/useNotices'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function NotificationsPage() {
  const { user } = useUser()
  const { notices, markRead, complete } = useNotices(user?.id)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>通知中心</strong>
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
              <div className="row">
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
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
