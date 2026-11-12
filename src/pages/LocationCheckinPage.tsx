import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { formatTaipei } from '@/lib/time'

type Phase = 'idle' | 'locating' | 'saving' | 'done' | 'error'

type Result = {
  recordedAt: string
  latitude: number
  longitude: number
  label: string
  address: string | null
}

function readGps(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('此裝置不支援定位'))
  }
  const tryOnce = (highAccuracy: boolean, timeout: number) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge: highAccuracy ? 0 : 60_000,
      })
    })
  return tryOnce(true, 15000).catch(() => tryOnce(false, 20000))
}

function geoErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = Number((err as GeolocationPositionError).code)
    if (code === 1) return '請允許位置權限後再試'
    if (code === 2) return '目前讀不到位置，請到空曠處再試'
    if (code === 3) return '定位逾時，請再試一次'
  }
  return toUserMessage(err, '定位失敗，請再試一次')
}

export function LocationCheckinPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const runId = useRef(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function startLocate() {
    if (!user) return
    const myRun = ++runId.current
    setPhase('locating')
    setError(null)
    setResult(null)
    try {
      // User gesture required in LINE / iOS WebView.
      const pos = await readGps()
      if (myRun !== runId.current) return
      setPhase('saving')
      const latitude = pos.coords.latitude
      const longitude = pos.coords.longitude
      let address: string | null = null
      let label = '目前位置（網站 GPS）'
      try {
        const geo = await reverseGeocode(latitude, longitude)
        address = geo?.address ?? null
        label = geo?.label || address || label
      } catch {
        /* address optional */
      }
      const saved = formal
        ? await supabaseRepos.createLocationCheckin(user, {
            label,
            address,
            latitude,
            longitude,
            source: 'web_gps',
          })
        : (() => {
            const open = localDb.getOpenAttendance(user.id)
            const row = {
              id: crypto.randomUUID(),
              organizationId: user.organizationId,
              userId: user.id,
              recordedAt: new Date().toISOString(),
              source: 'web_gps' as const,
              siteId: null,
              label,
              address,
              latitude,
              longitude,
              note: null,
              attendanceId: open?.id ?? null,
            }
            localDb.saveLocationCheckin(row)
            return row
          })()
      if (myRun !== runId.current) return
      setResult({
        recordedAt: saved.recordedAt,
        latitude,
        longitude,
        label: saved.label || label,
        address: saved.address ?? address,
      })
      setPhase('done')
    } catch (err) {
      if (myRun !== runId.current) return
      setError(geoErrorMessage(err))
      setPhase('error')
    }
  }

  if (!user) return <div className="empty">請先登入</div>

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>紀錄地點</strong>
      </section>

      <section className="panel stack">
        {phase === 'idle' ? (
          <>
            <h2 style={{ margin: 0 }}>留下目前位置</h2>
            <p className="muted" style={{ margin: 0 }}>
              請按下方按鈕並允許定位。
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void startLocate()}
            >
              開始定位
            </button>
          </>
        ) : null}

        {phase === 'locating' ? (
          <>
            <h2 style={{ margin: 0 }}>定位中…</h2>
            <p className="muted" style={{ margin: 0 }}>
              請允許瀏覽器使用位置。
            </p>
          </>
        ) : null}

        {phase === 'saving' ? (
          <>
            <h2 style={{ margin: 0 }}>寫入中…</h2>
            <p className="muted" style={{ margin: 0 }}>
              正在查地址並儲存地點紀錄。
            </p>
          </>
        ) : null}

        {phase === 'done' && result ? (
          <>
            <div className="badge ok">完成</div>
            <h2 style={{ margin: 0 }}>地點紀錄完成</h2>
            <p style={{ margin: 0 }}>
              時間：{formatTaipei(result.recordedAt, 'yyyy/MM/dd HH:mm')}
            </p>
            <p style={{ margin: 0 }}>
              地址：{result.address?.trim() || result.label}
            </p>
            {!result.address ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                暫無法解析地址，已存座標：{result.latitude.toFixed(5)},{' '}
                {result.longitude.toFixed(5)}
              </p>
            ) : null}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn-steel" to="/">
                回首頁
              </Link>
              <Link className="btn btn-ghost" to="/attendance">
                看出勤時間軸
              </Link>
            </div>
          </>
        ) : null}

        {phase === 'error' ? (
          <>
            <h2 style={{ margin: 0 }}>無法完成紀錄</h2>
            <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
            <button
              type="button"
              className="btn btn-steel"
              onClick={() => void startLocate()}
            >
              再試一次
            </button>
          </>
        ) : null}
      </section>
    </div>
  )
}
