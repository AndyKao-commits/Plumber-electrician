import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { selectOpenSites } from '@/domain/siteStatus'
import { useNotices, noticeKeys } from '@/hooks/useNotices'
import { useSites } from '@/hooks/useSites'
import { useTeam } from '@/hooks/useTeam'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { enqueueOfflineOp, isBrowserOnline } from '@/lib/offlineQueue'
import { notifyOfflineQueueChanged } from '@/lib/offlineSync'
import { supabaseRepos } from '@/lib/supabaseRepos'

export function TodosPage() {
  const { user } = useUser()
  const { todos, complete } = useNotices(user?.id)
  const { sites } = useSites()
  const openSites = useMemo(() => selectOpenSites(sites), [sites])
  const { members } = useTeam()
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [siteId, setSiteId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [showForm, setShowForm] = useState(false)

  const createTodo = useMutation({
    mutationFn: async () => {
      const href = siteId ? `/sites/${siteId}` : '/todos'
      const detailText =
        detail ||
        (siteId
          ? `工地：${sites.find((s) => s.id === siteId)?.name || ''}`
          : '')
      const assignee =
        assigneeId ||
        user?.id ||
        ''
      if (!user) throw new Error('尚未登入')
      if (!formal) {
        return localDb.createAssignedTodo(
          { id: user.id, name: user.name },
          {
            title,
            detail: detailText,
            assigneeUserId: assignee,
            href,
          },
        )
      }
      if (!isBrowserOnline()) {
        enqueueOfflineOp({
          operationType: 'manual_todo',
          payload: { title, detail: detailText, href, assigneeUserId: assignee },
        })
        notifyOfflineQueueChanged()
        return { queued: true as const }
      }
      await supabaseRepos.createAssignedTodo(user, {
        title,
        detail: detailText,
        href,
        assigneeUserId: assignee,
      })
      return { queued: false as const }
    },
    onSuccess: () => {
      if (!user) return
      void queryClient.invalidateQueries({ queryKey: noticeKeys.list(user.id) })
      setTitle('')
      setDetail('')
      setSiteId('')
      setAssigneeId('')
      setShowForm(false)
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await createTodo.mutateAsync()
  }

  const teammates = members.length
    ? members
    : localDb.getUsers().map((u) => ({
        userId: u.id,
        name: u.name,
        clockedIn: false,
        siteName: null as string | null,
      }))

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>待辦中心</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              可建立並指派給其他員工；不做 LINE 主動推播。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-steel"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '取消' : '新增／指派'}
          </button>
        </div>
      </section>

      {showForm ? (
        <section className="panel stack">
          <form className="stack" onSubmit={(e) => void onSubmit(e)}>
            <div className="field">
              <label htmlFor="todo-title">標題</label>
              <input
                id="todo-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="例如：補拍水電完工照"
              />
            </div>
            <div className="field">
              <label htmlFor="todo-detail">說明</label>
              <textarea
                id="todo-detail"
                rows={3}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="todo-assignee">指派給</label>
              <select
                id="todo-assignee"
                value={assigneeId || user?.id || ''}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                {teammates.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name}
                    {t.userId === user?.id ? '（自己）' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="todo-site">關聯工地（選填）</label>
              <select
                id="todo-site"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="">不指定</option>
                {openSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            {createTodo.error ? (
              <p style={{ color: 'var(--danger)', margin: 0 }}>
                {toUserMessage(createTodo.error)}
              </p>
            ) : null}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={createTodo.isPending || !title.trim()}
            >
              {createTodo.isPending ? '新增中…' : '新增'}
            </button>
          </form>
        </section>
      ) : null}

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
