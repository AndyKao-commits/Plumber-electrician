import { Link } from 'react-router-dom'
import { FEATURE_FLAGS, HOME_SHORTCUTS, PRODUCT } from '@/domain/rules'
import { computeCaseFinance } from '@/domain/fieldFinance'
import { useAttendance } from '@/hooks/useAttendance'
import { useFieldFinance } from '@/hooks/useFieldFinance'
import { useNotices } from '@/hooks/useNotices'
import { useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'
import { localDb } from '@/lib/localDb'
import { useMemo } from 'react'

export function HomePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const { todos, unreadCount } = useNotices(user?.id)
  const { quotes } = useQuotes(user?.id)
  const { expenses, receipts } = useFieldFinance(user?.id)
  const {
    openShift,
    clockIn,
    clockOut,
    isClockingIn,
    isClockingOut,
  } = useAttendance(user?.id)

  const busy = isClockingIn || isClockingOut
  const shortcutIds = localDb.getShortcutIds()
  const shortcuts = HOME_SHORTCUTS.filter((s) => shortcutIds.includes(s.id))
  const isBoss = user?.role === 'boss'

  const acceptedContract = useMemo(
    () =>
      (quotes ?? [])
        .filter((q) => q.workflowStatus === 'accepted')
        .reduce((s, q) => s + Number(q.amountAfterTax || 0), 0),
    [quotes],
  )

  const summary = useMemo(
    () =>
      computeCaseFinance({
        acceptedContractAmount: acceptedContract,
        confirmedExpenseTotal: expenses
          .filter((e) => e.status === 'confirmed')
          .reduce((s, e) => s + e.amount, 0),
        pendingExpenseTotal: expenses
          .filter((e) => e.status === 'pending_review')
          .reduce((s, e) => s + e.amount, 0),
        confirmedReceiptTotal: receipts
          .filter((e) => e.status === 'confirmed')
          .reduce((s, e) => s + e.amount, 0),
        pendingReceiptTotal: receipts
          .filter((e) => e.status === 'pending_confirm')
          .reduce((s, e) => s + e.amount, 0),
      }),
    [acceptedContract, expenses, receipts],
  )

  const pendingExpenses = expenses.filter((e) => e.status === 'pending_review')
  const pendingReceipts = receipts.filter((e) => e.status === 'pending_confirm')

  return (
    <div className="stack fade-up">
      <section className="panel hero-panel stack">
        <div className="row between">
          <div>
            <div className="badge">V1.0 現場＋審核</div>
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
            : '不主動推播 LINE；師傅用選單操作，老闆在網站審核。'}
        </p>
      </section>

      {isBoss ? (
        <section className="panel stack">
          <strong>老闆總覽</strong>
          <div className="grid-2">
            <Link className="site-link" to="/sites">
              <p>案件數</p>
              <h3>{sites.length}</h3>
            </Link>
            <Link className="site-link" to="/expenses">
              <p>待審核支出</p>
              <h3>{pendingExpenses.length}</h3>
            </Link>
            <Link className="site-link" to="/expenses">
              <p>待確認收款</p>
              <h3>{pendingReceipts.length}</h3>
            </Link>
            <div className="site-link">
              <p>有效合約</p>
              <h3>NT${summary.acceptedContractAmount.toLocaleString()}</h3>
            </div>
            <div className="site-link">
              <p>已確認支出</p>
              <h3>NT${summary.confirmedExpenseTotal.toLocaleString()}</h3>
            </div>
            <div className="site-link">
              <p>已確認收款</p>
              <h3>NT${summary.confirmedReceiptTotal.toLocaleString()}</h3>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel stack">
          <strong>我的回報</strong>
          <p className="muted" style={{ margin: 0 }}>
            待審核支出{' '}
            {
              expenses.filter(
                (e) =>
                  e.reportedBy === user?.id && e.status === 'pending_review',
              ).length
            }{' '}
            · 待確認收款{' '}
            {
              receipts.filter(
                (r) =>
                  r.reportedBy === user?.id && r.status === 'pending_confirm',
              ).length
            }
          </p>
          <Link className="btn btn-steel" to="/expenses">
            去回報支出／收款
          </Link>
        </section>
      )}

      <section className="panel stack">
        <div className="row between">
          <strong>快捷功能</strong>
        </div>
        <div className="shortcut-grid">
          {shortcuts.map((item) => (
            <Link key={item.id} className="shortcut-tile" to={item.path}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <div className="row between">
          <strong>今日待辦</strong>
          <Link to="/todos">全部</Link>
        </div>
        {todos.length === 0 ? (
          <div className="empty">目前沒有待辦</div>
        ) : (
          todos.slice(0, 4).map((todo) => (
            <Link key={todo.id} className="site-link" to={todo.href || '/todos'}>
              <h3>{todo.title}</h3>
              <p>{todo.detail}</p>
            </Link>
          ))
        )}
      </section>

      {openShift && !openShift.siteId ? (
        <section className="panel stack">
          <strong>補登目前工地</strong>
          <p className="muted" style={{ margin: 0 }}>
            已於 {formatTaipei(openShift.clockInAt, 'HH:mm')} 上班。選擇正在施工的工地：
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
    </div>
  )
}
