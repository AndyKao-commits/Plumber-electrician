import { useRef, useState } from 'react'
import { LiffFrame } from '@/components/LiffFrame'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { formatTaipei } from '@/lib/time'

type Phase = 'idle' | 'locating' | 'saving' | 'done' | 'error'

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
  // High accuracy first; fall back for LINE WebView / indoor GPS.
  return tryOnce(true, 15000).catch(() => tryOnce(false, 20000))
}

function geoErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = Number((err as GeolocationPositionError).code)
    if (code === 1) return '請允許位置權限後再按「開始定位」'
    if (code === 2) return '讀不到位置，請到空曠處或開啟手機定位後再試'
    if (code === 3) return '定位逾時，請再試一次'
  }
  return toUserMessage(err, '定位失敗，請再試一次')
}

export function LiffLocationPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const runId = useRef(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  async function startLocate() {
    if (!user) return
    const myRun = ++runId.current
    setPhase('locating')
    setError(null)
    setSummary(null)
    try {
      // Must run from a user tap — LINE / iOS block auto geolocation on load.
      const pos = await readGps()
      if (myRun !== runId.current) return
      setPhase('saving')
      const latitude = pos.coords.latitude
      const longitude = pos.coords.longitude
      let address: string | null = null
      let label = '目前位置'
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
      setSummary(
        `${formatTaipei(saved.recordedAt, 'HH:mm')} · ${
          saved.address?.trim() || saved.label || label
        }`,
      )
      setPhase('done')
    } catch (err) {
      if (myRun !== runId.current) return
      setError(geoErrorMessage(err))
      setPhase('error')
    }
  }

  return (
    <LiffFrame title="紀錄地點">
      <section className="panel stack">
        {phase === 'idle' ? (
          <>
            <strong style={{ margin: 0 }}>留下目前位置</strong>
            <p className="muted" style={{ margin: 0 }}>
              請按下方按鈕並允許定位（不會自動上下班）。
            </p>
            <button
              type="button"
              className="clock-btn in"
              onClick={() => void startLocate()}
            >
              開始定位
            </button>
          </>
        ) : null}
        {phase === 'locating' ? (
          <>
            <strong style={{ margin: 0 }}>定位中…</strong>
            <p className="muted" style={{ margin: 0 }}>
              請允許使用位置。
            </p>
          </>
        ) : null}
        {phase === 'saving' ? (
          <strong style={{ margin: 0 }}>寫入中…</strong>
        ) : null}
        {phase === 'done' ? (
          <>
            <span className="badge ok">完成</span>
            <strong style={{ margin: 0 }}>地點已紀錄</strong>
            <p style={{ margin: 0 }}>{summary}</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPhase('idle')
                setSummary(null)
                setError(null)
              }}
            >
              再記一次
            </button>
          </>
        ) : null}
        {phase === 'error' ? (
          <>
            <strong style={{ margin: 0 }}>無法完成</strong>
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
    </LiffFrame>
  )
}
