import { PHOTO_TYPE_LABELS, type PhotoType } from '@/domain/photoTypes'
import {
  PDF_SHEET_STYLE,
  downloadBlob,
  escapeHtml,
  htmlPagesToPdfBlob,
  sanitizeFilename,
} from '@/lib/pdfHtml'

export type SitePhotoPdfItem = {
  previewUrl: string
  photoType?: PhotoType | string | null
  createdAt: string
  uploaderName?: string | null
}

export { downloadBlob }

export function sitePhotosPdfFilename(siteName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${sanitizeFilename(siteName || '工地')}_施工照片_${date}.pdf`
}

function photoPageHtml(
  siteName: string,
  photo: SitePhotoPdfItem,
  index: number,
  total: number,
): string {
  const typeLabel =
    PHOTO_TYPE_LABELS[(photo.photoType as PhotoType) || 'unclassified'] || '照片'
  const when = new Date(photo.createdAt).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
  })
  const who = photo.uploaderName?.trim() || ''
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8" /><style>${PDF_SHEET_STYLE}</style></head><body>
<div class="pdf-sheet">
  <div class="photo-wrap">
    <img src="${escapeHtml(photo.previewUrl)}" crossorigin="anonymous" alt="施工照片" />
    <div class="photo-caption">
      <strong>${escapeHtml(siteName)}</strong>
      <div class="muted">${index + 1}/${total} · ${escapeHtml(typeLabel)} · ${escapeHtml(when)}${who ? ` · ${escapeHtml(who)}` : ''}</div>
    </div>
  </div>
</div>
</body></html>`
}

/** One photo per A4 page; Chinese captions via HTML capture (no jsPDF text font issues). */
export async function generateSitePhotosPdfBlob(input: {
  siteName: string
  photos: SitePhotoPdfItem[]
}): Promise<Blob> {
  if (input.photos.length === 0) throw new Error('此工地尚無照片可匯出')
  const pages = input.photos.map((photo, i) =>
    photoPageHtml(input.siteName, photo, i, input.photos.length),
  )
  return htmlPagesToPdfBlob(pages)
}
