import { Link } from 'react-router-dom'
import { useNotices } from '@/hooks/useNotices'
import { useUser } from '@/hooks/useUser'

export function TodosPage() {
  const { user } = useUser()
  const { todos, complete } = useNotices(user?.id)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>待辦中心</strong>
        <p className="muted" style={{ margin: 0 }}>
          系統預設排序；之後可自行切換。延期需填原因。不做 LINE 推播。
        </p>
      </section>

      <section className="stack">
        {todos.length === 0 ? (
          <div className="panel empty">目前沒有待辦</div>
        ) : (
          todos.map((todo) => (
            <div key={todo.id} className="panel stack">
              <strong>{todo.title}</strong>
              <p className="muted" style={{ margin: 0 }}>
                {todo.detail}
              </p>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void complete(todo.id)}
                >
                  完成
                </button>
                {todo.href ? (
                  <Link className="btn btn-ghost" to={todo.href}>
                    前往處理
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
