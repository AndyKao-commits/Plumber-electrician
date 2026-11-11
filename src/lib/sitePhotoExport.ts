import { jsPDF } from 'jspdf'
import { PHOTO_TYPE_LABELS, type PhotoType } from '@/domain/photoTypes'

export type SitePhotoPdfItem = {
  previewUrl: string
  photoType?: PhotoType | string | null
  createdAt: string
  uploaderName?: string | null
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60)
}

export function sitePhotosPdfFilename(siteName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${sanitizeFilename(siteName || '工地')}_施工照片_${date}.pdf`
}

async function loadImageDataUrl(url: string): Promise<{
  dataUrl: string
  width: number
  height: number
  format: 'JPEG' | 'PNG' | 'WEBP'
}> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('無法載入照片')
  const blob = await res.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('讀取照片失敗'))
    reader.readAsDataURL(blob)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('照片格式無法預覽'))
    el.src = dataUrl
  })
  const mime = blob.type || 'image/jpeg'
  const format: 'JPEG' | 'PNG' | 'WEBP' = mime.includes('png')
    ? 'PNG'
    : mime.includes('webp')
      ? 'WEBP'
      : 'JPEG'
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight, format }
}

/** One photo per A4 page; cover + caption. */
export async function generateSitePhotosPdfBlob(input: {
  siteName: string
  photos: SitePhotoPdfItem[]
}): Promise<Blob> {
  if (input.photos.length === 0) throw new Error('此工地尚無照片可匯出')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 12
  const captionH = 18
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2 - captionH

  for (let i = 0; i < input.photos.length; i++) {
    if (i > 0) pdf.addPage()
    const photo = input.photos[i]
    const loaded = await loadImageDataUrl(photo.previewUrl)
    const ratio = Math.min(maxW / loaded.width, maxH / loaded.height)
    const drawW = loaded.width * ratio
    const drawH = loaded.height * ratio
    const x = (pageW - drawW) / 2
    const y = margin + (maxH - drawH) / 2

    pdf.addImage(loaded.dataUrl, loaded.format, x, y, drawW, drawH, undefined, 'FAST')

    const typeLabel =
      PHOTO_TYPE_LABELS[(photo.photoType as PhotoType) || 'unclassified'] ||
      '照片'
    const when = new Date(photo.createdAt).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
    })
    const who = photo.uploaderName?.trim() || ''
    pdf.setFontSize(11)
    pdf.text(input.siteName, margin, pageH - margin - 8)
    pdf.setFontSize(9)
    pdf.setTextColor(90)
    pdf.text(
      `${i + 1}/${input.photos.length} · ${typeLabel} · ${when}${who ? ` · ${who}` : ''}`,
      margin,
      pageH - margin,
    )
    pdf.setTextColor(0)
  }

  return pdf.output('blob')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
