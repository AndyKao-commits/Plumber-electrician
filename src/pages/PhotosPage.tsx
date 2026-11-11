import { useMemo, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  PHOTO_TYPE_LABELS,
  PHOTO_TYPE_OPTIONS,
  groupPhotosByType,
  type PhotoType,
} from '@/domain/photoTypes'
import { useAttendance } from '@/hooks/useAttendance'
import { usePhotos } from '@/hooks/usePhotos'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'

export function PhotosPage() {
  const [params] = useSearchParams()
  const scopedSiteId = params.get('siteId')
  const { user, isFormalMode } = useUser()
  const {
    photos,
    isLoading,
    error,
    linkPhoto,
    classifyPhoto,
    discardPhoto,
    isLinking,
    isClassifying,
    isDiscarding,
    uploadPhoto,
    isUploading,
    uploadError,
  } = usePhotos(scopedSiteId)
  const { sites } = useSites()
  const { openShift } = useAttendance(user?.id)
  const [siteDraft, setSiteDraft] = useState<Record<string, string>>({})
  const [typeDraft, setTypeDraft] = useState<Record<string, PhotoType>>({})
  const [uploadSiteId, setUploadSiteId] = useState(
    scopedSiteId ?? openShift?.siteId ?? '',
  )
  const [uploadPhotoType, setUploadPhotoType] =
    useState<PhotoType>('unclassified')
  const [filterType, setFilterType] = useState<PhotoType | 'all'>('all')

  const scopedSite = sites.find((s) => s.id === scopedSiteId)
  const effectiveUploadSite = scopedSiteId || uploadSiteId

  const pending = useMemo(
    () => photos.filter((p) => p.status === 'pending'),
    [photos],
  )
  const linked = useMemo(
    () => photos.filter((p) => p.status === 'linked'),
    [photos],
  )
  const linkedFiltered = useMemo(() => {
    if (filterType === 'all') return linked
    return linked.filter((p) => (p.photoType || 'unclassified') === filterType)
  }, [linked, filterType])
  const grouped = useMemo(() => groupPhotosByType(linked), [linked])

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!effectiveUploadSite) {
      window.alert('請先選擇工地，再上傳照片')
      return
    }
    await uploadPhoto({
      file,
      siteId: effectiveUploadSite,
      photoType: uploadPhotoType,
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
            <strong>
              {scopedSite ? `${scopedSite.name} · 工地照片` : '施工照片'}
            </strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {scopedSite
                ? '僅顯示此工地已歸檔照片；上傳也會直接歸入本工地。'
                : '上傳時請選擇工地與分類；LINE 未指定工地的照片會進待處理。'}
            </p>
          </div>
          <span className="badge steel">{dataModeLabel()}</span>
        </div>
        {scopedSite ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-ghost" to={`/sites/${scopedSite.id}`}>
              回工地檔案
            </Link>
            <Link className="btn btn-ghost" to="/photos">
              全部照片
            </Link>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>上傳（分類引導）</strong>
        {!scopedSiteId ? (
          <div className="field">
            <label htmlFor="upload-site">工地（必填）</label>
            <select
              id="upload-site"
              value={uploadSiteId}
              onChange={(e) => setUploadSiteId(e.target.value)}
            >
              <option value="">選擇工地…</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="upload-type">照片分類</label>
          <select
            id="upload-type"
            value={uploadPhotoType}
            onChange={(e) => setUploadPhotoType(e.target.value as PhotoType)}
          >
            {PHOTO_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {PHOTO_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <label
          className="btn btn-steel"
          style={{ display: 'inline-block', textAlign: 'center' }}
        >
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

      {!scopedSiteId ? (
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
                {new Date(photo.createdAt).toLocaleString('zh-TW', {
                  timeZone: 'Asia/Taipei',
                })}
                （台北） · {photo.source}
              </p>
              <div className="field">
                <label htmlFor={`site-${photo.id}`}>指定工地</label>
                <select
                  id={`site-${photo.id}`}
                  value={siteDraft[photo.id] ?? ''}
                  onChange={(e) =>
                    setSiteDraft((prev) => ({
                      ...prev,
                      [photo.id]: e.target.value,
                    }))
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
              <div className="field">
                <label htmlFor={`type-${photo.id}`}>照片分類</label>
                <select
                  id={`type-${photo.id}`}
                  value={typeDraft[photo.id] ?? 'unclassified'}
                  onChange={(e) =>
                    setTypeDraft((prev) => ({
                      ...prev,
                      [photo.id]: e.target.value as PhotoType,
                    }))
                  }
                >
                  {PHOTO_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {PHOTO_TYPE_LABELS[t]}
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
                    void linkPhoto({
                      photoId: photo.id,
                      siteId: siteDraft[photo.id],
                      photoType: typeDraft[photo.id] ?? 'unclassified',
                    })
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
      ) : null}

      <section className="stack">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <strong>
            {scopedSite ? '本工地照片' : '已歸檔'}（{linkedFiltered.length}）
          </strong>
          <select
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value as PhotoType | 'all')
            }
            aria-label="依分類篩選"
          >
            <option value="all">全部分類</option>
            {PHOTO_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {PHOTO_TYPE_LABELS[t]}（{grouped[t].length}）
              </option>
            ))}
          </select>
        </div>
        {linkedFiltered.length === 0 && !isLoading ? (
          <div className="empty">尚無照片。</div>
        ) : null}
        {linkedFiltered.slice(0, 40).map((photo) => (
          <div key={photo.id} className="site-link stack">
            {photo.previewUrl ? (
              <img
                src={photo.previewUrl}
                alt="已歸檔照片"
                style={{
                  width: '100%',
                  maxHeight: 180,
                  objectFit: 'cover',
                  borderRadius: 8,
                }}
              />
            ) : null}
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <p style={{ margin: 0 }}>
                {photo.siteName || '未知名工地'} ·{' '}
                {PHOTO_TYPE_LABELS[photo.photoType || 'unclassified']} ·{' '}
                {photo.uploaderName || '未知'}
              </p>
              <select
                value={photo.photoType || 'unclassified'}
                disabled={isClassifying}
                onChange={(e) =>
                  void classifyPhoto({
                    photoId: photo.id,
                    photoType: e.target.value,
                  })
                }
                aria-label="更新分類"
              >
                {PHOTO_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {PHOTO_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
