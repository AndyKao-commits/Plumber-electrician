import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/** A4 @ 96dpi CSS px ≈ 794×1123 */
export const A4_CSS_WIDTH_PX = 794

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render HTML pages (Chinese-safe via system fonts) into a multi-page A4 PDF.
 * Each string is one full page.
 */
export async function htmlPagesToPdfBlob(pagesHtml: string[]): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('PDF 僅能在瀏覽器環境產生')
  }
  if (pagesHtml.length === 0) throw new Error('沒有可匯出的內容')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < pagesHtml.length; i++) {
    const host = document.createElement('div')
    host.setAttribute('data-pdf-html-host', '1')
    host.style.cssText =
      'position:fixed;left:-12000px;top:0;width:794px;background:#fff;z-index:-1;opacity:1;'
    host.innerHTML = pagesHtml[i]
    document.body.appendChild(host)
    try {
      const sheet = host.querySelector('.pdf-sheet') as HTMLElement | null
      if (!sheet) throw new Error('PDF 版面渲染失敗')
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => setTimeout(r, 40))
      const canvas = await html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: sheet.scrollWidth,
        windowHeight: sheet.scrollHeight,
      })
      if (!canvas.width || !canvas.height) {
        throw new Error('PDF 畫面擷取失敗')
      }
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
    } finally {
      host.remove()
    }
  }

  const blob = pdf.output('blob')
  if (!blob || blob.size < 100) throw new Error('PDF 產生失敗（檔案為空）')
  return blob
}

export const PDF_SHEET_STYLE = `
.pdf-sheet {
  width: 794px;
  min-height: 1123px;
  box-sizing: border-box;
  padding: 48px 56px;
  background: #fff;
  color: #1c2430;
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif;
  font-size: 14px;
  line-height: 1.55;
}
.pdf-sheet h1 { font-size: 28px; margin: 0 0 12px; }
.pdf-sheet h2 { font-size: 18px; margin: 28px 0 10px; border-bottom: 1px solid #d8dee6; padding-bottom: 6px; }
.pdf-sheet h3 { font-size: 15px; margin: 16px 0 6px; }
.pdf-sheet p { margin: 0 0 8px; }
.pdf-sheet .muted { color: #667085; font-size: 12px; }
.pdf-sheet .meta { margin-top: 8px; color: #445; }
.pdf-sheet table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
.pdf-sheet th, .pdf-sheet td { border: 1px solid #d8dee6; padding: 6px 8px; text-align: left; vertical-align: top; }
.pdf-sheet th { background: #f5f7fa; }
.pdf-sheet .photo-wrap {
  display: flex;
  flex-direction: column;
  height: 1027px;
}
.pdf-sheet .photo-wrap img {
  flex: 1;
  width: 100%;
  object-fit: contain;
  background: #f0f2f5;
  border-radius: 8px;
}
.pdf-sheet .photo-caption { margin-top: 14px; font-size: 13px; }
`
