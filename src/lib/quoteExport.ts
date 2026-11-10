import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { QuoteExportSnapshot } from '@/domain/types'
import { QUOTE_ITEM_KIND_LABELS } from '@/domain/rules'
import { PRODUCT } from '@/domain/rules'

export type QuotePdfOptions = {
  companyName?: string
  contactPhone?: string | null
  constructionNotes?: string | null
  generatedAtLabel?: string
}

function money(n: number): string {
  return `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`
}

function display(v: string | null | undefined, fallback = '—'): string {
  const s = String(v ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return fallback
  return s
}

export function quotePdfFilename(snapshot: QuoteExportSnapshot): string {
  const title = sanitizeFilename(snapshot.title || '報價案件')
  const date = (snapshot.quoteDate || new Date().toISOString().slice(0, 10)).replace(
    /-/g,
    '',
  )
  return `${title}_報價單_v${snapshot.versionNo}_${date}.pdf`
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60)
}

/** Professional A4 HTML used for PDF render and print. */
export function buildQuotePrintHtml(
  snapshot: QuoteExportSnapshot,
  options: QuotePdfOptions = {},
): string {
  const company = display(options.companyName, PRODUCT.name)
  const phone = display(options.contactPhone, '')
  const construction = display(options.constructionNotes, '')
  const notes = display(snapshot.notes, '')
  const generated =
    options.generatedAtLabel ||
    new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })

  const itemRows =
    snapshot.items.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:18px;color:#666">尚未建立報價細項</td></tr>`
      : snapshot.items
          .map(
            (i) => `
      <tr>
        <td class="c">${i.lineNo}</td>
        <td>${escapeHtml(QUOTE_ITEM_KIND_LABELS[i.kind] || '工程項目')}</td>
        <td>${escapeHtml(display(i.description))}</td>
        <td class="r">${formatQty(i.qty)}</td>
        <td class="c">${escapeHtml(display(i.unit))}</td>
        <td class="r">${money(i.unitPrice)}</td>
        <td class="r">${money(i.amount)}</td>
      </tr>`,
          )
          .join('')

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(snapshot.quoteNumber)} v${snapshot.versionNo}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    color: #1c2430;
    font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    font-size: 12px;
    line-height: 1.45;
    background: #fff;
  }
  .sheet { width: 210mm; max-width: 794px; padding: 18mm 16mm; margin: 0 auto; background: #fff; }
  .brand { font-size: 13px; letter-spacing: 0.08em; color: #4a5568; }
  .doc-title { font-size: 26px; font-weight: 700; margin: 6px 0 2px; color: #0f2744; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 14px 0 18px; }
  .meta-grid .k { color: #718096; font-size: 11px; }
  .meta-grid .v { font-weight: 600; }
  .section { margin-top: 16px; }
  .section h2 {
    font-size: 13px; margin: 0 0 8px; padding-bottom: 4px;
    border-bottom: 2px solid #0f2744; color: #0f2744;
  }
  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.items th, table.items td {
    border: 1px solid #d8dee8; padding: 7px 6px; vertical-align: top;
    word-break: break-word;
  }
  table.items th {
    background: #edf2f7; font-size: 11px; color: #2d3748; font-weight: 700;
  }
  table.items .c { text-align: center; }
  table.items .r { text-align: right; white-space: nowrap; }
  .totals {
    width: 280px; margin: 14px 0 0 auto; border-collapse: collapse;
  }
  .totals td { padding: 5px 0; }
  .totals .lab { color: #4a5568; }
  .totals .amt { text-align: right; font-variant-numeric: tabular-nums; }
  .totals .grand td {
    border-top: 2px solid #0f2744; padding-top: 8px;
    font-size: 15px; font-weight: 800; color: #0f2744;
  }
  .footer-block { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
  .footer-block p { margin: 4px 0; }
  .muted { color: #718096; font-size: 11px; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
</style>
</head>
<body>
  <div class="sheet" id="quote-sheet">
    <div class="brand">${escapeHtml(company)}</div>
    <div class="doc-title">工程報價單</div>
    <div class="meta-grid">
      <div><div class="k">報價單編號</div><div class="v">${escapeHtml(display(snapshot.quoteNumber))}</div></div>
      <div><div class="k">報價版本</div><div class="v">v${snapshot.versionNo}</div></div>
      <div><div class="k">報價日期</div><div class="v">${escapeHtml(display(snapshot.quoteDate))}</div></div>
      <div><div class="k">有效期限</div><div class="v">${escapeHtml(display(snapshot.validUntil))}</div></div>
    </div>

    <div class="section">
      <h2>客戶與案件資訊</h2>
      <div class="meta-grid">
        <div><div class="k">客戶名稱</div><div class="v">${escapeHtml(display(snapshot.customerName))}</div></div>
        <div><div class="k">聯絡方式</div><div class="v">${escapeHtml(phone || '—')}</div></div>
        <div><div class="k">案件名稱</div><div class="v">${escapeHtml(display(snapshot.title))}</div></div>
        <div><div class="k">工地地址</div><div class="v">${escapeHtml(display(snapshot.siteAddress))}</div></div>
      </div>
    </div>

    <div class="section">
      <h2>報價明細</h2>
      <table class="items">
        <thead>
          <tr>
            <th style="width:8%">項次</th>
            <th style="width:12%">工程項目</th>
            <th style="width:30%">說明</th>
            <th style="width:10%">數量</th>
            <th style="width:10%">單位</th>
            <th style="width:15%">單價</th>
            <th style="width:15%">小計</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <table class="totals">
      <tr><td class="lab">小計</td><td class="amt">${money(snapshot.subtotal)}</td></tr>
      <tr><td class="lab">折扣</td><td class="amt">${money(snapshot.discount)}</td></tr>
      <tr><td class="lab">稅額</td><td class="amt">${money(snapshot.taxAmount)}</td></tr>
      <tr class="grand"><td>報價總金額</td><td class="amt">${money(snapshot.total)}</td></tr>
    </table>

    <div class="footer-block">
      <p><strong>付款方式</strong>：${escapeHtml(display(snapshot.paymentTerms, '依約定'))}</p>
      ${
        construction
          ? `<p><strong>施工備註</strong>：${escapeHtml(construction)}</p>`
          : ''
      }
      ${notes ? `<p><strong>報價備註</strong>：${escapeHtml(notes)}</p>` : ''}
      <p><strong>聯絡資訊</strong>：${escapeHtml(company)}${phone ? `　${escapeHtml(phone)}` : ''}</p>
      <p class="muted">版本產生時間：${escapeHtml(generated)}</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Generate a real PDF Blob via off-screen HTML → canvas → jsPDF.
 * Avoids blank popup windows (noopener / blocked popups).
 */
export async function generateQuotePdfBlob(
  snapshot: QuoteExportSnapshot,
  options: QuotePdfOptions = {},
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('PDF 僅能在瀏覽器環境產生')
  }

  const host = document.createElement('div')
  host.setAttribute('data-quote-pdf-host', '1')
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:794px;background:#fff;z-index:-1;opacity:1;'
  host.innerHTML = buildQuotePrintHtml(snapshot, options)
  document.body.appendChild(host)

  try {
    const sheet = host.querySelector('#quote-sheet') as HTMLElement | null
    if (!sheet) throw new Error('報價單版面渲染失敗')

    // Ensure layout/fonts settle before capture
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => setTimeout(r, 50))

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
    })

    if (!canvas.width || !canvas.height) {
      throw new Error('PDF 畫面擷取失敗（空白畫布）')
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 0
    const usableWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * usableWidth) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    let heightLeft = imgHeight
    let position = margin
    pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 1) {
      position = margin - (imgHeight - heightLeft)
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, imgHeight)
      heightLeft -= pageHeight
    }

    const blob = pdf.output('blob')
    if (!blob || blob.size < 100) {
      throw new Error('PDF 產生失敗（檔案為空）')
    }
    return blob
  } finally {
    host.remove()
  }
}

export function downloadBlob(filename: string, blob: Blob) {
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

export function buildQuoteCsv(snapshot: QuoteExportSnapshot): string {
  const lines: string[] = [
    ['報價單編號', '版本', '報價日期', '客戶', '案件', '工地'].join(','),
    [
      csv(snapshot.quoteNumber),
      String(snapshot.versionNo),
      csv(snapshot.quoteDate),
      csv(snapshot.customerName),
      csv(snapshot.title),
      csv(snapshot.siteAddress),
    ].join(','),
    '',
    ['項次', '工程項目', '說明', '數量', '單位', '單價', '小計'].join(','),
  ]
  if (snapshot.items.length === 0) {
    lines.push(['', '', '尚未建立報價細項', '', '', '', ''].join(','))
  } else {
    for (const i of snapshot.items) {
      lines.push(
        [
          i.lineNo,
          csv(QUOTE_ITEM_KIND_LABELS[i.kind] || i.kind),
          csv(i.description),
          i.qty,
          csv(i.unit),
          i.unitPrice,
          i.amount,
        ].join(','),
      )
    }
  }
  lines.push('')
  lines.push(['小計', snapshot.subtotal].join(','))
  lines.push(['折扣', snapshot.discount].join(','))
  lines.push(['稅額', snapshot.taxAmount].join(','))
  lines.push(['報價總金額', snapshot.total].join(','))
  lines.push(['付款方式', csv(snapshot.paymentTerms)].join(','))
  lines.push(['有效期限', csv(snapshot.validUntil || '')].join(','))
  lines.push(['備註', csv(snapshot.notes)].join(','))
  return '\uFEFF' + lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  downloadBlob(filename, new Blob([content], { type: mime }))
}

/**
 * Print using a same-document hidden iframe (not a blank popup).
 * Avoids noopener blank windows and popup blockers.
 */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'quote-print')
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    if (!win || !doc) {
      iframe.remove()
      reject(new Error('無法建立列印內容，請稍後再試'))
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 800)
    }

    const run = () => {
      try {
        win.focus()
        win.print()
        cleanup()
        resolve()
      } catch {
        cleanup()
        reject(new Error('列印失敗，請檢查瀏覽器列印設定'))
      }
    }

    // Wait for layout
    setTimeout(run, 250)
  })
}

/** @deprecated use printHtmlDocument — kept for call-site migration */
export function openPrintWindow(html: string) {
  return printHtmlDocument(html)
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Number(n.toFixed(3)))
}

function csv(v: string): string {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
