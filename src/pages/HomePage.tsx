import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FEATURE_FLAGS, PRODUCT } from '@/domain/rules'
import { useAttendance } from '@/hooks/useAttendance'
import { useFieldFinance } from '@/hooks/useFieldFinance'
import { useNotices, noticeKeys } from '@/hooks/useNotices'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { formatTaipei } from '@/lib/time'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useEffect, useRef } from 'react'

export function HomePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const { todos, unreadCount } = useNotices(user?.id)
  const queryClient = useQueryClient()
  const warrantyChecked = useRef(false)

  useEffect(() => {
    if (!user || !isFormalMode() || warrantyChecked.current) return
    warrantyChecked.current = true
    void supabaseRepos
      .ensureWarrantyNotices(user, 30)
      .then((n) => {
        if (n > 0) {
          void queryClient.invalidateQueries({
            queryKey: noticeKeys.list(user.id),
          })
        }
      })
      .catch(() => {
        /* non-blocking */
      })
  }, [queryClient, user])

  const { expenses, receipts } = useFieldFinance(user?.id)
  const {
    openShift,
    clockIn,
    clockOut,
    isClockingIn,
    isClockingOut,
  } = useAttendance(user?.id)

  const busy = isClockingIn || isClockingOut
  const isBoss = user?.role === 'boss'
  const pendingExpenses = expenses.filter((e) => e.status === 'pending_review')
  const pendingReceipts = receipts.filter((e) => e.status === 'pending_confirm')
  const myPendingExpenses = expenses.filter(
    (e) => e.reportedBy === user?.id && e.status === 'pending_review',
  ).length
  const myPendingReceipts = receipts.filter(
    (r) => r.reportedBy === user?.id && r.status === 'pending_confirm',
  ).length

  return (
    <div className="stack fade-up">
      <section className="panel hero-panel stack">
        <div className="row between">
          <div>
            <div className="badge">V1.0</div>
            <h2 style={{ margin: '10px 0 4px', fontSize: '1.7rem' }}>
              你好，{user?.name}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {PRODUCT.tagline} · {formatTaipei(new Date(), 'M月d日 EEEE')}
            </p>
          </div>
          <Link to="/notifications" className="badge steel">
            通知 {unreadCount}
          </Link>
        </div>

        {openShift ? (
          <div className="row">
            <span className="pulse-dot" aria-hidden />
            <span>上班中</span>
          </div>
        ) : null}

        {openShift ? (
          <button
            type="button"
            className="clock-btn out"
            disabled={busy}
            onClick={() => void clockOut()}
          >
            {isClockingOut ? '下班打卡中…' : '下班打卡'}
          </button>
        ) : (
          <button
            type="button"
            className="clock-btn in"
            disabled={busy}
            onClick={() => void clockIn()}
          >
            {isClockingIn ? '上班打卡中…' : '一鍵上班'}
          </button>
        )}

        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          {FEATURE_FLAGS.lineProactivePush
            ? 'LINE 推播啟用中'
            : '不主動推播 LINE。現場用選單，審核在網站。'}
        </p>
      </section>

      {openShift && !openShift.siteId ? (
        <section className="panel stack">
          <strong>補登目前工地</strong>
          <p className="muted" style={{ margin: 0 }}>
            已於 {formatTaipei(openShift.clockInAt, 'HH:mm')}{' '}
            上班。選正在施工的工地：
          </p>
          <div className="stack">
            {sites.slice(0, 4).map((site) => (
              <Link key={site.id} className="site-link" to={`/sites/${site.id}`}>
                <h3>{site.name}</h3>
                <p>
                  {site.kind === 'formal' ? '正式工程' : '臨時維修'}
                  {site.address ? ` · ${site.address}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {isBoss ? (
        <section className="panel stack">
          <strong>今天要處理</strong>
          <div className="grid-2">
            <Link className="site-link" to="/expenses">
              <p>待審核支出</p>
              <h3>{pendingExpenses.length}</h3>
            </Link>
            <Link className="site-link" to="/expenses">
              <p>待確認收款</p>
              <h3>{pendingReceipts.length}</h3>
            </Link>
            <Link className="site-link" to="/todos">
              <p>待辦</p>
              <h3>{todos.length}</h3>
            </Link>
            <Link className="site-link" to="/sites">
              <p>工地／案件</p>
              <h3>{sites.length}</h3>
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel stack">
          <strong>我的回報</strong>
          <p className="muted" style={{ margin: 0 }}>
            待審核支出 {myPendingExpenses} · 待確認收款 {myPendingReceipts}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-steel" to="/expenses">
              支出／收款
            </Link>
            <Link className="btn btn-ghost" to="/sites">
              我的工地
            </Link>
          </div>
        </section>
      )}

      <section className="panel stack">
        <div className="row between">
          <strong>今日待辦</strong>
          <Link to="/todos">全部</Link>
        </div>
        {todos.length === 0 ? (
          <div className="empty">目前沒有待辦</div>
        ) : (
          todos.slice(0, 5).map((todo) => (
            <Link
              key={todo.id}
              className="site-link"
              to={todo.href || '/todos'}
            >
              <h3>{todo.title}</h3>
              <p>{todo.detail}</p>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
