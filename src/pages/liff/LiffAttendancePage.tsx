import { useMemo, useState } from 'react'
import { LiffFrame } from '@/components/LiffFrame'
import { selectOpenSites } from '@/domain/siteStatus'
import { useAttendance } from '@/hooks/useAttendance'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function LiffAttendancePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const openSites = useMemo(() => selectOpenSites(sites), [sites])
  const {
    openShift,
    clockIn,
    clockOut,
    assignSite,
    isClockingIn,
    isClockingOut,
    isAssigningSite,
  } = useAttendance(user?.id)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = isClockingIn || isClockingOut || isAssigningSite

  const siteName = openShift?.siteId
    ? sites.find((s) => s.id === openShift.siteId)?.name ?? '未知工地'
    : null

  async function onClockIn() {
    setError(null)
    setFlash(null)
    try {
      await clockIn()
      setFlash('已上班')
    } catch (e) {
      setError(e instanceof Error ? e.message : '上班失敗')
    }
  }

  async function onClockOut() {
    setError(null)
    setFlash(null)
    try {
      await clockOut()
      setFlash('已下班')
    } catch (e) {
      setError(e instanceof Error ? e.message : '下班失敗')
    }
  }

  async function onAssign(siteId: string) {
    setError(null)
    setFlash(null)
    try {
      await assignSite({ siteId })
      setFlash('已指定工地')
    } catch (e) {
      setError(e instanceof Error ? e.message : '指定工地失敗')
    }
  }

  return (
    <LiffFrame title="出勤打卡" liffEntry="attendance">
      <section className="panel stack">
        <p className="muted" style={{ margin: 0 }}>
          {formatTaipei(new Date(), 'yyyy/MM/dd HH:mm')}
        </p>
        <strong style={{ fontSize: '1.35rem', margin: 0 }}>
          {openShift ? '上班中' : '未上班'}
        </strong>
        {openShift ? (
          <>
            <p style={{ margin: 0 }}>
              上班：{formatTaipei(openShift.clockInAt, 'HH:mm')}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              工地：{siteName ?? '尚未指定'}
            </p>
            <button
              type="button"
              className="clock-btn out"
              disabled={busy}
              onClick={() => void onClockOut()}
            >
              {isClockingOut ? '下班中…' : '下班打卡'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="clock-btn in"
            disabled={busy}
            onClick={() => void onClockIn()}
          >
            {isClockingIn ? '上班中…' : '一鍵上班'}
          </button>
        )}
        {flash ? (
          <p style={{ color: 'var(--ok)', margin: 0 }}>{flash}</p>
        ) : null}
        {error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        ) : null}
      </section>

      {openShift ? (
        <section className="panel stack">
          <strong>{openShift.siteId ? '切換工地' : '指定工地'}</strong>
          {openSites.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              目前沒有進行中的工地。
            </p>
          ) : (
            openSites.map((site) => (
              <button
                key={site.id}
                type="button"
                className="btn btn-steel"
                style={{ width: '100%' }}
                disabled={busy || openShift.siteId === site.id}
                onClick={() => void onAssign(site.id)}
              >
                {site.name}
                {openShift.siteId === site.id ? '（目前）' : ''}
              </button>
            ))
          )}
        </section>
      ) : null}
    </LiffFrame>
  )
}
