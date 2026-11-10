import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAttendance } from '@/hooks/useAttendance'
import { usePhotos } from '@/hooks/usePhotos'
import { useReports } from '@/hooks/useReports'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'

export function ReportsPage() {
  const [params] = useSearchParams()
  const { user, isFormalMode } = useUser()
  const { sites } = useSites()
  const { openShift } = useAttendance(user?.id)
  const { photos } = usePhotos()
  const presetSite = params.get('siteId') || openShift?.siteId || ''
  const [siteId, setSiteId] = useState(presetSite)
  const [body, setBody] = useState('')
  const [photoId, setPhotoId] = useState('')
  const { reports, isLoading, error, createReport, isCreating, createError } = useReports(
    siteId || undefined,
  )

  const pendingPhotos = useMemo(
    () => photos.filter((p) => p.status === 'pending'),
    [photos],
  )

  const [queuedHint, setQueuedHint] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!siteId) return
    const result = await createReport({
      siteId,
      body,
      photoUploadId: photoId || null,
    })
    setBody('')
    setPhotoId('')
    if (result && 'queued' in result && result.queued) {
      setQueuedHint('已加入離線佇列，恢復網路後自動同步')
    } else {
      setQueuedHint('')
    }
  }

  if (!isFormalMode) {
    return (
      <div className="stack fade-up">
        <section className="panel stack">
          <strong>施工回報</strong>
          <p className="muted" style={{ margin: 0 }}>本機示範模式請切換正式模式。</p>
        </section>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>施工回報</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              文字或照片擇一即可；可先在 LINE／施工照片上傳，再於此歸檔。
            </p>
          </div>
          <span className="badge steel">{dataModeLabel()}</span>
        </div>
      </section>

      <section className="panel stack">
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label htmlFor="report-site">工地</label>
            <select
              id="report-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              required
            >
              <option value="">選擇工地…</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="report-body">回報內容</label>
            <textarea
              id="report-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="今日進度、異常、需協助事項…"
            />
          </div>
          <div className="field">
            <label htmlFor="report-photo">附上待處理照片（選填）</label>
            <select
              id="report-photo"
              value={photoId}
              onChange={(e) => setPhotoId(e.target.value)}
            >
              <option value="">不附照片</option>
              {pendingPhotos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {photo.uploaderName || '照片'} ·{' '}
                  {new Date(photo.createdAt).toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                  })}
                </option>
              ))}
            </select>
          </div>
          {createError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>{createError.message}</p>
          ) : null}
          {queuedHint ? (
            <p className="muted" style={{ margin: 0 }}>
              {queuedHint}
            </p>
          ) : null}
          <button className="btn btn-steel" type="submit" disabled={isCreating || !siteId}>
            {isCreating ? '送出中…' : '送出回報'}
          </button>
        </form>
      </section>

      <section className="stack">
        <strong>最近回報</strong>
        {isLoading ? <div className="empty">載入中…</div> : null}
        {error ? (
          <div className="empty" style={{ color: 'var(--danger)' }}>
            {error.message}
          </div>
        ) : null}
        {!isLoading && !error && reports.length === 0 ? (
          <div className="empty">尚無回報</div>
        ) : null}
        {reports.map((report) => (
          <div key={report.id} className="site-link stack">
            <div className="row between">
              <strong style={{ margin: 0 }}>{report.siteName || '工地'}</strong>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {new Date(report.createdAt).toLocaleString('zh-TW', {
                  timeZone: 'Asia/Taipei',
                })}
              </span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {report.authorName || '未知'} ·{' '}
              <Link to={`/sites/${report.siteId}`}>看工地</Link>
            </p>
            {report.body ? <p style={{ margin: 0 }}>{report.body}</p> : null}
            {report.photoPreviewUrl ? (
              <img
                src={report.photoPreviewUrl}
                alt="回報照片"
                style={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
            ) : null}
          </div>
        ))}
      </section>
    </div>
  )
}
