import {
  type LedgerEntry,
  summarizeLedger,
} from '@/domain/fieldFinance'
import {
  PDF_SHEET_STYLE,
  downloadBlob,
  escapeHtml,
  htmlPagesToPdfBlob,
  sanitizeFilename,
} from '@/lib/pdfHtml'

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildCashLedgerCsv(
  rows: LedgerEntry[],
  meta?: { title?: string; periodLabel?: string },
): string {
  const summary = summarizeLedger(rows)
  const lines: string[] = [
    ['收支簿', csvCell(meta?.title || ''), csvCell(meta?.periodLabel || '')].join(
      ',',
    ),
    [
      '筆數',
      summary.count,
      '支出合計',
      summary.expenseTotal,
      '收款合計',
      summary.receiptTotal,
      '淨額',
      summary.net,
    ].join(','),
    '',
    [
      '日期',
      '類型',
      '工地',
      '項目',
      '金額',
      '狀態',
      '回報人',
      '第幾次',
      '備註',
      '憑證',
    ].join(','),
  ]
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.date),
        csvCell(r.kind === 'expense' ? '支出' : '收款'),
        csvCell(r.siteName),
        csvCell(r.item),
        r.amount,
        csvCell(r.statusLabel),
        csvCell(r.reportedByName),
        csvCell(r.sequenceLabel || ''),
        csvCell(r.note || ''),
        csvCell(r.hasProof ? '有' : '無'),
      ].join(','),
    )
  }
  return '\uFEFF' + lines.join('\n')
}

export function downloadCashLedgerExcel(
  rows: LedgerEntry[],
  filenameBase: string,
  meta?: { title?: string; periodLabel?: string },
) {
  const content = buildCashLedgerCsv(rows, meta)
  const name = sanitizeFilename(filenameBase || '收支簿') + '.csv'
  downloadBlob(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
    name,
  )
}

function money(n: number): string {
  return `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`
}

export function buildCashLedgerPdfHtml(
  rows: LedgerEntry[],
  meta: { title: string; periodLabel: string; generatedAtLabel: string },
): string {
  const summary = summarizeLedger(rows)
  const body =
    rows.length === 0
      ? `<tr><td colspan="8" style="text-align:center;padding:18px;color:#666">此期間無明細</td></tr>`
      : rows
          .map(
            (r) => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${r.kind === 'expense' ? '支出' : '收款'}</td>
        <td>${escapeHtml(r.siteName)}</td>
        <td>${escapeHtml(r.item)}${r.sequenceLabel ? `<br/><span style="color:#666;font-size:12px">${escapeHtml(r.sequenceLabel)}</span>` : ''}</td>
        <td class="r">${money(r.amount)}</td>
        <td>${escapeHtml(r.statusLabel)}</td>
        <td>${escapeHtml(r.reportedByName)}</td>
        <td>${escapeHtml(r.note || '')}</td>
      </tr>`,
          )
          .join('')

  return `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8" />
<style>
${PDF_SHEET_STYLE}
.pdf-sheet table { width:100%; border-collapse:collapse; font-size:12px; }
.pdf-sheet th, .pdf-sheet td { border:1px solid #d8dee6; padding:6px 8px; vertical-align:top; }
.pdf-sheet th { background:#f3f6fa; text-align:left; }
.pdf-sheet td.r, .pdf-sheet th.r { text-align:right; }
.pdf-sheet .meta { color:#556; font-size:13px; margin:0 0 16px; }
</style></head><body>
<div class="pdf-sheet">
  <h1>${escapeHtml(meta.title)}</h1>
  <p class="meta">${escapeHtml(meta.periodLabel)} · 產生於 ${escapeHtml(meta.generatedAtLabel)}</p>
  <p>筆數 ${summary.count}　支出 ${money(summary.expenseTotal)}　收款 ${money(summary.receiptTotal)}　淨額 ${money(summary.net)}</p>
  <h2>明細</h2>
  <table>
    <thead>
      <tr>
        <th>日期</th><th>類型</th><th>工地</th><th>項目</th>
        <th class="r">金額</th><th>狀態</th><th>回報人</th><th>備註</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</div>
</body></html>`
}

export async function downloadCashLedgerPdf(
  rows: LedgerEntry[],
  filenameBase: string,
  meta: { title: string; periodLabel: string; generatedAtLabel: string },
) {
  const html = buildCashLedgerPdfHtml(rows, meta)
  const blob = await htmlPagesToPdfBlob([html])
  downloadBlob(blob, sanitizeFilename(filenameBase || '收支簿') + '.pdf')
}
