import type { QuoteExportSnapshot } from '@/domain/types'
import { QUOTE_ITEM_KIND_LABELS } from '@/domain/rules'

function money(n: number): string {
  return `NT$${Number(n || 0).toLocaleString()}`
}

/** Build printable HTML for PDF / print (browser Save as PDF). */
export function buildQuotePrintHtml(snapshot: QuoteExportSnapshot): string {
  const rows = snapshot.items
    .map(
      (i) => `
      <tr>
        <td>${i.lineNo}</td>
        <td>${escapeHtml(QUOTE_ITEM_KIND_LABELS[i.kind] || i.kind)}</td>
        <td>${escapeHtml(i.description)}</td>
        <td style="text-align:right">${i.qty}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td style="text-align:right">${money(i.unitPrice)}</td>
        <td style="text-align:right">${money(i.amount)}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(snapshot.quoteNumber)} v${snapshot.versionNo}</title>
<style>
  body { font-family: "Noto Sans TC", "PingFang TC", sans-serif; color: #1a1a1a; margin: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; }
  th { background: #f3f3f3; text-align: left; }
  .totals { margin-top: 16px; width: 280px; margin-left: auto; }
  .totals td { border: none; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 16px; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>報價單</h1>
  <div class="meta">
    編號 ${escapeHtml(snapshot.quoteNumber)} · 版本 v${snapshot.versionNo}<br/>
    報價日期 ${escapeHtml(snapshot.quoteDate)}<br/>
    客戶 ${escapeHtml(snapshot.customerName)} · 案件 ${escapeHtml(snapshot.title)}<br/>
    工地 ${escapeHtml(snapshot.siteAddress)}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>類型</th><th>說明</th><th>數量</th><th>單位</th><th>單價</th><th>小計</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="7">（無細項）</td></tr>'}</tbody>
  </table>
  <table class="totals">
    <tr><td>小計</td><td style="text-align:right">${money(snapshot.subtotal)}</td></tr>
    <tr><td>折扣</td><td style="text-align:right">${money(snapshot.discount)}</td></tr>
    <tr><td>稅額</td><td style="text-align:right">${money(snapshot.taxAmount)}</td></tr>
    <tr class="grand"><td>總金額</td><td style="text-align:right">${money(snapshot.total)}</td></tr>
  </table>
  <p><strong>付款方式</strong>：${escapeHtml(snapshot.paymentTerms)}</p>
  <p><strong>有效期限</strong>：${escapeHtml(snapshot.validUntil || '—')}</p>
  <p><strong>備註</strong>：${escapeHtml(snapshot.notes || '—')}</p>
</body>
</html>`
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
    ['序', '類型', '說明', '數量', '單位', '單價', '小計'].join(','),
  ]
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
  lines.push('')
  lines.push(['小計', snapshot.subtotal].join(','))
  lines.push(['折扣', snapshot.discount].join(','))
  lines.push(['稅額', snapshot.taxAmount].join(','))
  lines.push(['總金額', snapshot.total].join(','))
  lines.push(['付款方式', csv(snapshot.paymentTerms)].join(','))
  lines.push(['有效期限', csv(snapshot.validUntil || '')].join(','))
  lines.push(['備註', csv(snapshot.notes)].join(','))
  return '\uFEFF' + lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!w) throw new Error('無法開啟列印視窗，請允許彈出視窗')
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
  }, 300)
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
