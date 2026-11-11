import { Link } from 'react-router-dom'
import { MORE_MENU } from '@/domain/rules'
import { useNotices } from '@/hooks/useNotices'
import { useUser } from '@/hooks/useUser'

export function MorePage() {
  const { user } = useUser()
  const { unreadCount, todos } = useNotices(user?.id)
  const isBoss = user?.role === 'boss'

  const groups = MORE_MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const bossOnly = 'bossOnly' in item && item.bossOnly
      if (bossOnly && !isBoss) return false
      return true
    }),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>更多</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              待辦 {todos.length} 件
            </p>
          </div>
          <Link to="/notifications" className="badge steel">
            通知 {unreadCount}
          </Link>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="panel stack">
          <strong>{group.label}</strong>
          <div className="stack" style={{ gap: 8 }}>
            {group.items.map((item) => (
              <Link key={item.id} className="site-link" to={item.path}>
                <h3>{item.label}</h3>
                {item.description ? <p>{item.description}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
