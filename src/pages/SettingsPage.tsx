import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useOrgSpendSettings } from '@/hooks/useOrgSpendSettings'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'

export function SettingsPage() {
  const { user } = useUser()
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    isUpdating,
    updateError,
  } = useOrgSpendSettings(user)
  const isBoss = user?.role === 'boss'

  const [reportThreshold, setReportThreshold] = useState('')
  const [emergencySingle, setEmergencySingle] = useState('')
  const [emergencyDaily, setEmergencyDaily] = useState('')
  const [dailyPurchase, setDailyPurchase] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setReportThreshold(String(settings.reportReviewThresholdNtd))
    setEmergencySingle(String(settings.emergencySingleLimitNtd))
    setEmergencyDaily(String(settings.emergencyDailyLimitNtd))
    setDailyPurchase(String(settings.dailyPurchaseLimitNtd))
  }, [settings])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    await updateSettings({
      reportReviewThresholdNtd: Number(reportThreshold),
      emergencySingleLimitNtd: Number(emergencySingle),
      emergencyDailyLimitNtd: Number(emergencyDaily),
      dailyPurchaseLimitNtd: Number(dailyPurchase),
    })
    setSaved(true)
  }

  if (!isBoss) {
    return (
      <div className="stack fade-up">
        <section className="panel stack">
          <strong>額度設定</strong>
          <p className="muted" style={{ margin: 0 }}>
            僅老闆可調整支出審核門檻與每日上限。
          </p>
          <Link to="/">回首頁</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>額度設定</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              現場支出超過多少需老闆審核，以及每日／緊急上限。
            </p>
          </div>
          <span className="badge steel">{dataModeLabel()}</span>
        </div>
      </section>

      {isLoading ? <div className="empty">載入中…</div> : null}
      {error ? (
        <div className="empty" style={{ color: 'var(--danger)' }}>
          {error.message}
        </div>
      ) : null}

      <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="report-threshold">
            回報查核門檻（零用金／現場支出，NT$）
          </label>
          <input
            id="report-threshold"
            type="number"
            min={0}
            step={1}
            value={reportThreshold}
            onChange={(e) => setReportThreshold(e.target.value)}
            required
          />
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            未達門檻自動確認；達門檻以上進待審核。
          </p>
        </div>

        <div className="field">
          <label htmlFor="daily-purchase">每日採購合計上限（NT$）</label>
          <input
            id="daily-purchase"
            type="number"
            min={0}
            step={1}
            value={dailyPurchase}
            onChange={(e) => setDailyPurchase(e.target.value)}
            required
          />
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            每人每日一般＋緊急採購合計；填 0 表示不限制。
          </p>
        </div>

        <div className="field">
          <label htmlFor="emergency-single">緊急採購單次上限（NT$）</label>
          <input
            id="emergency-single"
            type="number"
            min={1}
            step={1}
            value={emergencySingle}
            onChange={(e) => setEmergencySingle(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="emergency-daily">緊急採購每日累計上限（NT$）</label>
          <input
            id="emergency-daily"
            type="number"
            min={1}
            step={1}
            value={emergencyDaily}
            onChange={(e) => setEmergencyDaily(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-steel" type="submit" disabled={isUpdating}>
          {isUpdating ? '儲存中…' : '儲存設定'}
        </button>
        {updateError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{updateError.message}</p>
        ) : null}
        {saved && !updateError ? (
          <p className="muted" style={{ margin: 0 }}>
            已儲存 · 更新於{' '}
            {new Date(settings.updatedAt).toLocaleString('zh-TW', {
              timeZone: 'Asia/Taipei',
            })}
            （台北）
          </p>
        ) : null}
      </form>
    </div>
  )
}
