import { useMemo, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import JSZip from 'jszip'
import {
  PHOTO_TYPE_LABELS,
  PHOTO_TYPE_OPTIONS,
  groupPhotosByType,
  type PhotoType,
} from '@/domain/photoTypes'
import type { PhotoUpload } from '@/domain/types'
import { useAttendance } from '@/hooks/useAttendance'
import { usePhotos } from '@/hooks/usePhotos'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { supabaseRepos } from '@/lib/supabaseRepos'
import {
  downloadBlob,
  generateSitePhotosPdfBlob,
  sitePhotosPdfFilename,
} from '@/lib/sitePhotoExport'

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
    deletePhotos,
    isLinking,
    isClassifying,
    isDiscarding,
    isDeleting,
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
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [viewer, setViewer] = useState<PhotoUpload | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  )
  const selectedPhotos = useMemo(
    () => linkedFiltered.filter((p) => selected[p.id]),
    [linkedFiltered, selected],
  )

  function toggleSelect(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleSelectAll() {
    if (
      linkedFiltered.length > 0 &&
      linkedFiltered.every((p) => selected[p.id])
    ) {
      setSelected({})
      return
    }
    const next: Record<string, boolean> = {}
    for (const p of linkedFiltered) next[p.id] = true
    setSelected(next)
  }

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

  async function onDeleteSelected() {
    if (selectedIds.length === 0) return
    if (!window.confirm(`確定刪除 ${selectedIds.length} 張照片？此操作無法復原。`)) {
      return
    }
    setActionError(null)
    setBusyAction('delete')
    try {
      await deletePhotos(selectedIds)
      setSelected({})
      if (viewer && selectedIds.includes(viewer.id)) setViewer(null)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusyAction(null)
    }
  }

  async function onDownloadSelected() {
    const targets = selectedPhotos.length > 0 ? selectedPhotos : linkedFiltered
    if (targets.length === 0) return
    setActionError(null)
    setBusyAction('download')
    try {
      const files = await supabaseRepos.downloadPhotoBlobs(
        targets.map((p) => ({
          id: p.id,
          storagePath: p.storagePath,
          contentType: p.contentType,
        })),
      )
      if (files.length === 1) {
        downloadBlob(files[0].blob, files[0].filename)
      } else {
        const zip = new JSZip()
        for (const f of files) zip.file(f.filename, f.blob)
        const blob = await zip.generateAsync({ type: 'blob' })
        const name = scopedSite
          ? `${scopedSite.name}_照片.zip`
          : `施工照片_${files.length}.zip`
        downloadBlob(blob, name.replace(/[\\/:*?"<>|]+/g, '_'))
      }
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusyAction(null)
    }
  }

  async function onExportPdf() {
    const targets = selectedPhotos.length > 0 ? selectedPhotos : linkedFiltered
    const withUrl = targets.filter((p) => p.previewUrl)
    if (withUrl.length === 0) {
      setActionError('沒有可匯出的照片')
      return
    }
    setActionError(null)
    setBusyAction('pdf')
    try {
      const blob = await generateSitePhotosPdfBlob({
        siteName: scopedSite?.name || '施工照片',
        photos: withUrl.map((p) => ({
          previewUrl: p.previewUrl!,
          photoType: p.photoType,
          createdAt: p.createdAt,
          uploaderName: p.uploaderName,
        })),
      })
      downloadBlob(blob, sitePhotosPdfFilename(scopedSite?.name || '施工照片'))
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusyAction(null)
    }
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
          <strong>
            {scopedSite ? `${scopedSite.name} · 工地照片` : '施工照片'}
          </strong>
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
        <strong>上傳</strong>
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
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: 0, border: 'none', background: 'transparent' }}
                  onClick={() => setViewer(photo)}
                >
                  <img
                    src={photo.previewUrl}
                    alt="施工照片"
                    style={{
                      width: '100%',
                      maxHeight: 240,
                      objectFit: 'cover',
                      borderRadius: 8,
                      display: 'block',
                    }}
                  />
                </button>
              ) : (
                <div className="empty">無法預覽</div>
              )}
              <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                {photo.uploaderName || '未知上傳者'} ·{' '}
                {new Date(photo.createdAt).toLocaleString('zh-TW', {
                  timeZone: 'Asia/Taipei',
                })}
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
                  disabled={isDiscarding || isDeleting}
                  onClick={() => void discardPhoto(photo.id)}
                >
                  捨棄
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    if (!window.confirm('確定刪除此照片？')) return
                    void deletePhotos([photo.id])
                  }}
                >
                  刪除
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

        {linkedFiltered.length > 0 ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={toggleSelectAll}
            >
              {linkedFiltered.every((p) => selected[p.id])
                ? '取消全選'
                : '全選'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={
                Boolean(busyAction) ||
                isDeleting ||
                (selectedIds.length === 0 && linkedFiltered.length === 0)
              }
              onClick={() => void onDownloadSelected()}
            >
              {busyAction === 'download'
                ? '下載中…'
                : selectedIds.length > 0
                  ? `下載選取（${selectedIds.length}）`
                  : '全部下載'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={
                Boolean(busyAction) ||
                isDeleting ||
                selectedIds.length === 0
              }
              onClick={() => void onDeleteSelected()}
            >
              {busyAction === 'delete' || isDeleting
                ? '刪除中…'
                : `刪除選取（${selectedIds.length}）`}
            </button>
            <button
              type="button"
              className="btn btn-steel"
              disabled={Boolean(busyAction) || linkedFiltered.length === 0}
              onClick={() => void onExportPdf()}
            >
              {busyAction === 'pdf'
                ? '匯出中…'
                : selectedIds.length > 0
                  ? `匯出 PDF（${selectedIds.length}）`
                  : '匯出 PDF'}
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{actionError}</p>
        ) : null}

        {linkedFiltered.length === 0 && !isLoading ? (
          <div className="empty">尚無照片。</div>
        ) : null}
        {linkedFiltered.map((photo) => (
          <div key={photo.id} className="site-link stack">
            <div className="row between" style={{ gap: 8 }}>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(selected[photo.id])}
                  onChange={() => toggleSelect(photo.id)}
                />
                <span>選取</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isDeleting}
                onClick={() => {
                  if (!window.confirm('確定刪除此照片？')) return
                  void deletePhotos([photo.id]).then(() => {
                    setSelected((prev) => {
                      const next = { ...prev }
                      delete next[photo.id]
                      return next
                    })
                  })
                }}
              >
                刪除
              </button>
            </div>
            {photo.previewUrl ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: 0, border: 'none', background: 'transparent' }}
                onClick={() => setViewer(photo)}
              >
                <img
                  src={photo.previewUrl}
                  alt="已歸檔照片"
                  style={{
                    width: '100%',
                    maxHeight: 180,
                    objectFit: 'cover',
                    borderRadius: 8,
                    display: 'block',
                  }}
                />
              </button>
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

      {viewer?.previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="照片預覽"
          onClick={() => setViewer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="stack"
            style={{ maxWidth: 720, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewer.previewUrl}
              alt="預覽"
              style={{
                width: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: 8,
                background: '#111',
              }}
            />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-steel"
                onClick={() => setViewer(null)}
              >
                關閉
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={Boolean(busyAction)}
                onClick={() => {
                  void (async () => {
                    setBusyAction('download')
                    try {
                      const files = await supabaseRepos.downloadPhotoBlobs([
                        {
                          id: viewer.id,
                          storagePath: viewer.storagePath,
                          contentType: viewer.contentType,
                        },
                      ])
                      downloadBlob(files[0].blob, files[0].filename)
                    } catch (e) {
                      setActionError((e as Error).message)
                    } finally {
                      setBusyAction(null)
                    }
                  })()
                }}
              >
                下載
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isDeleting}
                onClick={() => {
                  if (!window.confirm('確定刪除此照片？')) return
                  void deletePhotos([viewer.id]).then(() => setViewer(null))
                }}
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
