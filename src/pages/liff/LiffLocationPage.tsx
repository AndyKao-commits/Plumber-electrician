import { useEffect, useRef, useState } from 'react'
import { LiffFrame } from '@/components/LiffFrame'
import { useUser } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { enqueueOfflineOp, isBrowserOnline } from '@/lib/offlineQueue'
import { notifyOfflineQueueChanged } from '@/lib/offlineSync'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { formatTaipei } from '@/lib/time'

type Phase = 'locating' | 'saving' | 'done' | 'error'

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
    if (code === 1) return '請允許位置權限後再按「再試一次」'
    if (code === 2) return '讀不到位置，請到空曠處或開啟手機定位後再試'
    if (code === 3) return '定位逾時，請再試一次'
  }
  return toUserMessage(err, '定位失敗，請再試一次')
}

export function LiffLocationPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const runId = useRef(0)
  const [phase, setPhase] = useState<Phase>('locating')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!user) return
    const myRun = ++runId.current
    let cancelled = false

    async function run() {
      setPhase('locating')
      setError(null)
      setSummary(null)
      try {
        const pos = await readGps()
        if (cancelled || myRun !== runId.current) return
        setPhase('saving')
        const latitude = pos.coords.latitude
        const longitude = pos.coords.longitude
        let address: string | null = null
        let label = '目前位置'
        if (isBrowserOnline()) {
          try {
            const geo = await reverseGeocode(latitude, longitude)
            address = geo?.address ?? null
            label = geo?.label || address || label
          } catch {
            /* address optional */
          }
        } else {
          label = `離線座標 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        }
        const recordedAt = new Date().toISOString()
        let saved: { recordedAt: string; label?: string | null; address?: string | null }
        if (formal && !isBrowserOnline()) {
          enqueueOfflineOp({
            operationType: 'location_checkin',
            payload: {
              userId: user!.id,
              organizationId: user!.organizationId,
              label,
              address,
              latitude,
              longitude,
              recordedAt,
            },
          })
          notifyOfflineQueueChanged()
          saved = { recordedAt, label, address }
        } else if (formal) {
          saved = await supabaseRepos.createLocationCheckin(user!, {
            label,
            address,
            latitude,
            longitude,
            source: 'web_gps',
          })
        } else {
          const open = localDb.getOpenAttendance(user!.id)
          const row = {
            id: crypto.randomUUID(),
            organizationId: user!.organizationId,
            userId: user!.id,
            recordedAt,
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
          saved = row
        }
        if (cancelled || myRun !== runId.current) return
        const place = saved.address?.trim() || saved.label || label
        const offlineTag =
          formal && !isBrowserOnline() ? '已暫存（離線） · ' : ''
        setSummary(
          `${formatTaipei(saved.recordedAt, 'HH:mm')} · ${offlineTag}${place}`,
        )
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

  return (
    <LiffFrame title="紀錄地點" liffEntry="location">
      <section className="panel stack">
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
          </>
        ) : null}
        {phase === 'error' ? (
          <>
            <strong style={{ margin: 0 }}>無法完成</strong>
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
    </LiffFrame>
  )
}
