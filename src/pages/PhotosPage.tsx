import { useMemo, useState, type ChangeEvent } from 'react'
import { useAttendance } from '@/hooks/useAttendance'
import { usePhotos } from '@/hooks/usePhotos'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'

export function PhotosPage() {
  const { user, isFormalMode } = useUser()
  const {
    photos,
    isLoading,
    error,
    linkPhoto,
    discardPhoto,
    isLinking,
    isDiscarding,
    uploadPhoto,
    isUploading,
    uploadError,
  } = usePhotos()
  const { sites } = useSites()
  const { openShift } = useAttendance(user?.id)
  const [siteDraft, setSiteDraft] = useState<Record<string, string>>({})
  const [uploadSiteId, setUploadSiteId] = useState(openShift?.siteId ?? '')

  const pending = useMemo(
    () => photos.filter((p) => p.status === 'pending'),
    [photos],
  )
  const linked = useMemo(
    () => photos.filter((p) => p.status === 'linked'),
    [photos],
  )

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await uploadPhoto({
      file,
      siteId: uploadSiteId || openShift?.siteId || null,
    })
  }

  if (!isFormalMode) {
    return (
      <div className="stack fade-up">
        <section className="panel stack">
          <strong>施工照片</strong>
          <p className="muted" style={{ margin: 0 }}>
            本機示範模式不支援照片上傳。請切換正式模式。
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>施工照片</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              可在 LINE 傳圖，或在此直接上傳；未指定工地會進待處理。
            </p>
          </div>
          <span className="badge steel">{dataModeLabel()}</span>
        </div>
      </section>

      <section className="panel stack">
        <strong>本機／相機上傳</strong>
        <div className="field">
          <label htmlFor="upload-site">上傳時指定工地（選填）</label>
          <select
            id="upload-site"
            value={uploadSiteId}
            onChange={(e) => setUploadSiteId(e.target.value)}
          >
            <option value="">稍後再指定</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
        <label className="btn btn-steel" style={{ display: 'inline-block', textAlign: 'center' }}>
          {isUploading ? '上傳中…' : '選擇／拍攝照片'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={isUploading}
            onChange={(e) => void onPickFile(e)}
          />
        </label>
        {uploadError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{uploadError.message}</p>
        ) : null}
      </section>

      {isLoading ? <div className="empty">載入中…</div> : null}
      {error ? (
        <div className="empty" style={{ color: 'var(--danger)' }}>
          {error.message}
        </div>
      ) : null}

      <section className="stack">
        <strong>待指定工地（{pending.length}）</strong>
        {pending.length === 0 && !isLoading ? (
          <div className="empty">尚無待處理照片。</div>
        ) : null}
        {pending.map((photo) => (
          <div key={photo.id} className="site-link stack">
            {photo.previewUrl ? (
              <img
                src={photo.previewUrl}
                alt="施工照片"
                style={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
            ) : (
              <div className="empty">無法預覽</div>
            )}
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              {photo.uploaderName || '未知上傳者'} ·{' '}
              {new Date(photo.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
              （台北） · {photo.source}
            </p>
            <div className="field">
              <label htmlFor={`site-${photo.id}`}>指定工地</label>
              <select
                id={`site-${photo.id}`}
                value={siteDraft[photo.id] ?? ''}
                onChange={(e) =>
                  setSiteDraft((prev) => ({ ...prev, [photo.id]: e.target.value }))
                }
              >
                <option value="">選擇工地…</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-steel"
                type="button"
                disabled={isLinking || !siteDraft[photo.id]}
                onClick={() =>
                  void linkPhoto({ photoId: photo.id, siteId: siteDraft[photo.id] })
                }
              >
                歸檔到工地
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={isDiscarding}
                onClick={() => void discardPhoto(photo.id)}
              >
                捨棄
              </button>
            </div>
          </div>
        ))}
      </section>

      {linked.length > 0 ? (
        <section className="stack">
          <strong>已歸檔（最近）</strong>
          {linked.slice(0, 20).map((photo) => (
            <div key={photo.id} className="site-link stack">
              {photo.previewUrl ? (
                <img
                  src={photo.previewUrl}
                  alt="已歸檔照片"
                  style={{
                    width: '100%',
                    maxHeight: 160,
                    objectFit: 'cover',
                    borderRadius: 8,
                  }}
                />
              ) : null}
              <p style={{ margin: 0 }}>
                {photo.siteName || '未知名工地'} · {photo.uploaderName || '未知'}
              </p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
