import { PHOTO_TYPE_LABELS, type PhotoType } from '@/domain/photoTypes'
import { PRODUCT, QUOTE_ITEM_KIND_LABELS } from '@/domain/rules'
import type {
  ConstructionReport,
  DailyLog,
  Quotation,
  QuotationItem,
  SiteDefect,
  SiteProject,
} from '@/domain/types'
import {
  PDF_SHEET_STYLE,
  downloadBlob,
  escapeHtml,
  htmlPagesToPdfBlob,
  sanitizeFilename,
} from '@/lib/pdfHtml'
import type { SitePhotoPdfItem } from '@/lib/sitePhotoExport'

export const SITE_REPORT_PHOTO_LIMIT = 50

export type AcceptedQuoteBundle = {
  quote: Quotation
  items: QuotationItem[]
}

export type SiteReportInput = {
  site: SiteProject
  logs: DailyLog[]
  reports: ConstructionReport[]
  defects: SiteDefect[]
  acceptedQuotes: AcceptedQuoteBundle[]
  photos: SitePhotoPdfItem[]
  rangeStart: string
  rangeEnd: string
}

export { downloadBlob }

export function siteReportPdfFilename(siteName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${sanitizeFilename(siteName || '工地')}_施工報告_${date}.pdf`
}

function money(n: number): string {
  return `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`
}

function kindLabel(kind: SiteProject['kind']): string {
  return kind === 'formal' ? '正式工程' : '臨時維修'
}

function statusLabel(status: SiteProject['status']): string {
  switch (status) {
    case 'active':
      return '進行中'
    case 'pending_close':
      return '待結案'
    case 'closed':
      return '已結案'
    case 'warranty':
      return '保固中'
    default:
      return status
  }
}

function inRange(isoOrDate: string, start: string, end: string): boolean {
  const day = isoOrDate.slice(0, 10)
  return day >= start && day <= end
}

export function filterSiteReportInput(
  input: SiteReportInput,
): SiteReportInput {
  const { rangeStart, rangeEnd } = input
  return {
    ...input,
    logs: input.logs.filter((l) => inRange(l.logDate, rangeStart, rangeEnd)),
    reports: input.reports.filter((r) =>
      inRange(r.createdAt, rangeStart, rangeEnd),
    ),
    defects: input.defects.filter((d) =>
      inRange(d.createdAt, rangeStart, rangeEnd),
    ),
    photos: input.photos.filter((p) =>
      inRange(p.createdAt, rangeStart, rangeEnd),
    ),
    acceptedQuotes: input.acceptedQuotes,
  }
}

export function assertSiteReportHasContent(input: SiteReportInput): void {
  const filtered = filterSiteReportInput(input)
  const has =
    filtered.logs.length > 0 ||
    filtered.reports.length > 0 ||
    filtered.defects.length > 0 ||
    filtered.photos.length > 0 ||
    filtered.acceptedQuotes.length > 0
  if (!has) {
    throw new Error(
      '選定區間沒有可匯出的日誌、回報、缺失、照片或已接受報價。請調整日期或先補資料。',
    )
  }
}

function coverHtml(input: SiteReportInput, generatedAt: string): string {
  const { site, logs, reports, defects, acceptedQuotes, photos } = input
  const publishedLogs = logs.filter((l) => l.status === 'published').length
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8" /><style>${PDF_SHEET_STYLE}</style></head><body>
<div class="pdf-sheet">
  <p class="muted">${escapeHtml(PRODUCT.name)} · 施工報告</p>
  <h1>${escapeHtml(site.name)}</h1>
  <p class="meta">${escapeHtml(kindLabel(site.kind))} · ${escapeHtml(statusLabel(site.status))}</p>
  <p>客戶：${escapeHtml(site.customerName || '—')}</p>
  <p>地址：${escapeHtml(site.address || '—')}</p>
  <p>保固到期：${escapeHtml(site.warrantyUntil || '未設定')}</p>
  <p>報告區間：${escapeHtml(input.rangeStart)} ～ ${escapeHtml(input.rangeEnd)}</p>
  <p class="muted">匯出時間（台北）：${escapeHtml(generatedAt)}</p>
  <h2>資料摘要</h2>
  <table>
    <tr><th>項目</th><th>數量</th></tr>
    <tr><td>施工日誌</td><td>${logs.length}（已發布 ${publishedLogs}）</td></tr>
    <tr><td>施工回報</td><td>${reports.length}</td></tr>
    <tr><td>缺失紀錄</td><td>${defects.length}</td></tr>
    <tr><td>已接受報價</td><td>${acceptedQuotes.length}</td></tr>
    <tr><td>本報告照片</td><td>${photos.length}（上限 ${SITE_REPORT_PHOTO_LIMIT}）</td></tr>
  </table>
  ${site.notes ? `<h2>備註</h2><p>${escapeHtml(site.notes)}</p>` : ''}
</div>
</body></html>`
}

function chunkTextPages(title: string, blocks: string[]): string[] {
  if (blocks.length === 0) return []
  const pages: string[] = []
  const perPage = 8
  for (let i = 0; i < blocks.length; i += perPage) {
    const slice = blocks.slice(i, i + perPage).join('')
    pages.push(`<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8" /><style>${PDF_SHEET_STYLE}</style></head><body>
<div class="pdf-sheet"><h2>${escapeHtml(title)}${blocks.length > perPage ? `（${Math.floor(i / perPage) + 1}）` : ''}</h2>${slice}</div></body></html>`)
  }
  return pages
}

function logsAndReportsHtml(input: SiteReportInput): string[] {
  const logBlocks = [...input.logs]
    .sort((a, b) => b.logDate.localeCompare(a.logDate))
    .map((log) => {
      const body = (log.body || '').trim() || '（無內容）'
      return `<h3>${escapeHtml(log.logDate)} · ${log.status === 'published' ? '已發布' : '草稿'}</h3>
<p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>
<p class="muted">回報 ${log.summary.reportCount} · 照片 ${log.summary.photoCount} · 缺失 ${log.summary.defectCount}</p>`
    })

  const reportBlocks = [...input.reports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const when = new Date(r.createdAt).toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
      })
      const body = (r.body || '').trim() || '（僅照片／無文字）'
      return `<h3>${escapeHtml(when)} · ${escapeHtml(r.authorName || '未知')}</h3>
<p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>`
    })

  return [
    ...chunkTextPages('施工日誌', logBlocks),
    ...chunkTextPages('施工回報', reportBlocks),
  ]
}

function defectsHtml(defects: SiteDefect[]): string[] {
  const blocks = [...defects]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => {
      const when = new Date(d.createdAt).toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
      })
      return `<h3>${escapeHtml(d.title)} · ${escapeHtml(d.status)}</h3>
<p class="muted">${escapeHtml(when)} · ${d.severity === 'safety' ? '安全缺失' : '一般缺失'}</p>
<p>${escapeHtml((d.detail || '').trim() || '（無說明）').replace(/\n/g, '<br/>')}</p>`
    })
  return chunkTextPages('缺失紀錄', blocks)
}

function quotesHtml(bundles: AcceptedQuoteBundle[]): string[] {
  if (bundles.length === 0) return []
  return bundles.map((b) => {
    const q = b.quote
    const rows =
      b.items.length === 0
        ? `<tr><td colspan="6" class="muted">無細項</td></tr>`
        : b.items
            .slice()
            .sort((a, c) => a.lineNo - c.lineNo)
            .map(
              (it) => `<tr>
<td>${it.lineNo}</td>
<td>${escapeHtml(QUOTE_ITEM_KIND_LABELS[it.kind] || it.kind)}</td>
<td>${escapeHtml(it.description)}</td>
<td>${it.qty} ${escapeHtml(it.unit)}</td>
<td>${money(it.unitPrice)}</td>
<td>${money(it.amount)}</td>
</tr>`,
            )
            .join('')
    return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8" /><style>${PDF_SHEET_STYLE}</style></head><body>
<div class="pdf-sheet">
  <h2>已接受報價</h2>
  <h3>${escapeHtml(q.title)}</h3>
  <p class="muted">${escapeHtml(q.quoteNumber)} · 客戶 ${escapeHtml(q.customerName || '—')}</p>
  <p>工地地址：${escapeHtml(q.siteAddress || '—')}</p>
  <p>合計：${money(q.amountAfterTax)}（折扣前 ${money(q.amountBeforeTax)}）</p>
  <table>
    <tr><th>項次</th><th>項目</th><th>說明</th><th>數量</th><th>單價</th><th>小計</th></tr>
    ${rows}
  </table>
  ${q.notes ? `<p>備註：${escapeHtml(q.notes)}</p>` : ''}
</div>
</body></html>`
  })
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
      <strong>${escapeHtml(siteName)} · 施工照片</strong>
      <div class="muted">${index + 1}/${total} · ${escapeHtml(typeLabel)} · ${escapeHtml(when)}${who ? ` · ${escapeHtml(who)}` : ''}</div>
    </div>
  </div>
</div>
</body></html>`
}

export async function generateSiteReportPdfBlob(
  input: SiteReportInput,
): Promise<Blob> {
  const filtered = filterSiteReportInput(input)
  assertSiteReportHasContent(filtered)
  const photos = filtered.photos.slice(0, SITE_REPORT_PHOTO_LIMIT)
  const generatedAt = new Date().toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
  })
  const pages = [
    coverHtml({ ...filtered, photos }, generatedAt),
    ...logsAndReportsHtml(filtered),
    ...defectsHtml(filtered.defects),
    ...quotesHtml(filtered.acceptedQuotes),
    ...photos.map((p, i) => photoPageHtml(filtered.site.name, p, i, photos.length)),
  ]
  return htmlPagesToPdfBlob(pages)
}
