import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { formatTaipei } from '@/lib/time'

type Phase = 'locating' | 'saving' | 'done' | 'error'

type Result = {
  recordedAt: string
  latitude: number
  longitude: number
  label: string
  address: string | null
}

function readGps(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('此裝置不支援定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    })
  })
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
  const [phase, setPhase] = useState<Phase>('locating')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!user) return
    const myRun = ++runId.current
    let cancelled = false

    async function run() {
      setPhase('locating')
      setError(null)
      setResult(null)
      try {
        const pos = await readGps()
        if (cancelled || myRun !== runId.current) return
        setPhase('saving')
        const latitude = pos.coords.latitude
        const longitude = pos.coords.longitude
        const geo = await reverseGeocode(latitude, longitude)
        const address = geo?.address ?? null
        const label = geo?.label || address || '目前位置（網站 GPS）'
        const saved = formal
          ? await supabaseRepos.createLocationCheckin(user!, {
              label,
              address,
              latitude,
              longitude,
              source: 'web_gps',
            })
          : (() => {
              const open = localDb.getOpenAttendance(user!.id)
              const row = {
                id: crypto.randomUUID(),
                organizationId: user!.organizationId,
                userId: user!.id,
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
        if (cancelled || myRun !== runId.current) return
        setResult({
          recordedAt: saved.recordedAt,
          latitude,
          longitude,
          label: saved.label || label,
          address: saved.address ?? address,
        })
        setPhase('done')
      } catch (err) {
        if (cancelled || myRun !== runId.current) return
        setError(geoErrorMessage(err))
        setPhase('error')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [user, formal, nonce])

  if (!user) return <div className="empty">請先登入</div>

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>紀錄地點</strong>
        <p className="muted" style={{ margin: 0 }}>
          由 LINE 開啟：自動取得 GPS 並寫入足跡（優先顯示地址），不影響上下班。網站顯示完成即可，LINE
          不用再點完成。
        </p>
      </section>

      <section className="panel stack">
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
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                座標：{result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
              </p>
            )}
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
              onClick={() => setNonce((n) => n + 1)}
            >
              再試一次
            </button>
          </>
        ) : null}
      </section>
    </div>
  )
}
