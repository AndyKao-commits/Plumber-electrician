import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useOrgSpendSettings } from '@/hooks/useOrgSpendSettings'
import { useUser } from '@/hooks/useUser'

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
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setReportThreshold(String(settings.reportReviewThresholdNtd))
  }, [settings])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    // Keep legacy purchase-limit columns unchanged; V1 only edits 收支審核門檻.
    await updateSettings({
      reportReviewThresholdNtd: Number(reportThreshold),
      emergencySingleLimitNtd: settings.emergencySingleLimitNtd,
      emergencyDailyLimitNtd: settings.emergencyDailyLimitNtd,
      dailyPurchaseLimitNtd: settings.dailyPurchaseLimitNtd,
    })
    setSaved(true)
  }

  if (!isBoss) {
    return (
      <div className="stack fade-up">
        <section className="panel stack">
          <strong>收支審核設定</strong>
          <p className="muted" style={{ margin: 0 }}>
            僅老闆可調整現場支出／收支審核門檻。
          </p>
          <Link to="/">回首頁</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>收支審核設定</strong>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          材料、吃飯等花費請走「收支」登記與審核；採購模組已不使用。
        </p>
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
            收支／現場支出審核門檻（NT$）
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
