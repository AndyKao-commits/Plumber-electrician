import { Link } from 'react-router-dom'
import {
  DEFAULT_PURCHASE_RULES,
  FEATURE_FLAGS,
  HOME_SHORTCUTS,
  PRODUCT,
} from '@/domain/rules'
import { useAttendance } from '@/hooks/useAttendance'
import { useNotices } from '@/hooks/useNotices'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'
import { localDb } from '@/lib/localDb'

export function HomePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const { todos, unreadCount } = useNotices(user?.id)
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

  return (
    <div className="stack fade-up">
      <section className="panel hero-panel stack">
        <div className="row between">
          <div>
            <div className="badge">今日待辦＋快捷</div>
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
            : '不主動推播 LINE；待辦與通知只在系統內顯示。'}
          {FEATURE_FLAGS.gpsOptionalOnClockIn ? ' GPS 僅輔助定位。' : ''}
        </p>
      </section>

      <section className="panel stack">
        <div className="row between">
          <strong>快捷功能</strong>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            可自訂順序（之後）
          </span>
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

      <section className="panel stack">
        <strong>採購額度（已確認）</strong>
        <div className="grid-2">
          <div className="site-link">
            <p>一般採購事前核准</p>
            <h3>NT${DEFAULT_PURCHASE_RULES.preApprovalThresholdNtd.toLocaleString()}+</h3>
          </div>
          <div className="site-link">
            <p>緊急單次／每日</p>
            <h3>
              {DEFAULT_PURCHASE_RULES.emergencySingleLimitNtd.toLocaleString()} /{' '}
              {DEFAULT_PURCHASE_RULES.emergencyDailyLimitNtd?.toLocaleString()}
            </h3>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          以最終應付金額（折扣後含稅運）判斷；材料成本採移動加權平均。
        </p>
      </section>
    </div>
  )
}
