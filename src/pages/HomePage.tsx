import { Link } from 'react-router-dom'
import {
  DEFAULT_PURCHASE_RULES,
  FEATURE_FLAGS,
  PRODUCT,
} from '@/domain/rules'
import { useAttendance } from '@/hooks/useAttendance'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function HomePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const {
    openShift,
    clockIn,
    clockOut,
    isClockingIn,
    isClockingOut,
  } = useAttendance(user?.id)

  const busy = isClockingIn || isClockingOut

  return (
    <div className="stack fade-up">
      <section className="panel hero-panel stack">
        <div className="row between">
          <div>
            <div className="badge">今日作業</div>
            <h2 style={{ margin: '10px 0 4px', fontSize: '1.7rem' }}>
              你好，{user?.name}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {PRODUCT.tagline} · {formatTaipei(new Date(), 'M月d日 EEEE')}
            </p>
          </div>
          {openShift ? (
            <div className="row">
              <span className="pulse-dot" aria-hidden />
              <span>上班中</span>
            </div>
          ) : null}
        </div>

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
          {FEATURE_FLAGS.gpsOptionalOnClockIn
            ? 'GPS 僅輔助定位，不會擋住一鍵打卡。工地可稍後補登。'
            : '請完成打卡。'}
        </p>
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
          <Link className="btn btn-steel btn-block" to="/attendance">
            到出勤頁補登
          </Link>
        </section>
      ) : null}

      <section className="panel stack">
        <div className="row between">
          <strong>工地速覽</strong>
          <Link to="/sites">全部</Link>
        </div>
        <div className="grid-2">
          {sites.slice(0, 4).map((site) => (
            <Link key={site.id} className="site-link" to={`/sites/${site.id}`}>
              <div className="badge steel" style={{ marginBottom: 8 }}>
                {site.kind === 'formal' ? '正式' : '臨時'}
              </div>
              <h3>{site.name}</h3>
              <p>{site.customerName || site.address || '尚未填客戶／地址'}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <strong>已確認採購規則</strong>
        <div className="grid-2">
          <div className="site-link">
            <p>一般採購事前核准</p>
            <h3>NT${DEFAULT_PURCHASE_RULES.preApprovalThresholdNtd.toLocaleString()}+</h3>
          </div>
          <div className="site-link">
            <p>緊急採購單次上限</p>
            <h3>NT${DEFAULT_PURCHASE_RULES.emergencySingleLimitNtd.toLocaleString()}</h3>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          每日緊急採購累計上限與供應商信用額度仍待確認。
        </p>
      </section>
    </div>
  )
}
