import {
  PAY_TYPE_LABELS,
  SALARY_CATEGORY_LABELS,
  SALARY_STATUS_LABELS,
  summarizeSalaryMonth,
} from '@/domain/salary'
import type {
  EmployeePaySetting,
  SalaryEntry,
  SalaryPayment,
} from '@/domain/types'
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

export function buildSalarySlipCsv(input: {
  employeeName: string
  year: number
  month: number
  setting: EmployeePaySetting | null
  entries: SalaryEntry[]
  payments: SalaryPayment[]
}): string {
  const summary = summarizeSalaryMonth(input.entries, input.payments)
  const period = `${input.year}/${String(input.month).padStart(2, '0')}`
  const lines: string[] = [
    ['薪資單', csvCell(input.employeeName), period].join(','),
    [
      '出工天數',
      summary.workDays,
      '應領',
      summary.confirmedTotal,
      '實領',
      summary.paidTotal,
      '尚未支付',
      summary.unpaidTotal,
      '待確認',
      summary.pendingTotal,
    ].join(','),
    [
      '薪資設定',
      input.setting
        ? `${PAY_TYPE_LABELS[input.setting.payType]} ${input.setting.baseAmount}`
        : '未設定',
    ].join(','),
    '',
    ['日期', '類別', '項目', '金額', '狀態', '備註'].join(','),
  ]
  for (const e of input.entries) {
    if (e.status === 'cancelled') continue
    lines.push(
      [
        csvCell(e.entryDate),
        csvCell(SALARY_CATEGORY_LABELS[e.category]),
        csvCell(e.title),
        e.amount,
        csvCell(SALARY_STATUS_LABELS[e.status]),
        csvCell(e.note || ''),
      ].join(','),
    )
  }
  lines.push('')
  lines.push(['付款日', '結算月', '實付金額', '備註'].join(','))
  for (const p of input.payments) {
    lines.push(
      [
        csvCell(p.paidOn),
        `${p.settlementYear}/${p.settlementMonth}`,
        p.amount,
        csvCell(p.note || ''),
      ].join(','),
    )
  }
  return '\uFEFF' + lines.join('\n')
}

export function downloadSalarySlipExcel(
  input: Parameters<typeof buildSalarySlipCsv>[0],
  filenameBase: string,
) {
  const content = buildSalarySlipCsv(input)
  downloadBlob(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
    sanitizeFilename(filenameBase || '薪資單') + '.csv',
  )
}

export async function downloadSalarySlipPdf(
  input: Parameters<typeof buildSalarySlipCsv>[0],
  filenameBase: string,
) {
  const summary = summarizeSalaryMonth(input.entries, input.payments)
  const period = `${input.year} 年 ${input.month} 月`
  const rows = input.entries
    .filter((e) => e.status !== 'cancelled')
    .map(
      (e) => `<tr>
        <td>${escapeHtml(e.entryDate)}</td>
        <td>${escapeHtml(SALARY_CATEGORY_LABELS[e.category])}</td>
        <td>${escapeHtml(e.title)}</td>
        <td style="text-align:right">NT$${e.amount.toLocaleString()}</td>
        <td>${escapeHtml(SALARY_STATUS_LABELS[e.status])}</td>
      </tr>`,
    )
    .join('')
  const pays = input.payments
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.paidOn)}</td>
        <td>NT$${p.amount.toLocaleString()}</td>
        <td>${escapeHtml(p.note || '')}</td>
      </tr>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>${PDF_SHEET_STYLE}
      h1{font-size:18px;margin:0 0 8px}
      .meta{color:#555;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#f5f5f5}
      .sum{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
      .sum div{border:1px solid #eee;padding:8px;border-radius:8px}
    </style></head><body>
    <h1>薪資單 · ${escapeHtml(input.employeeName)}</h1>
    <p class="meta">${escapeHtml(period)}${
      input.setting
        ? ` · ${PAY_TYPE_LABELS[input.setting.payType]} NT$${input.setting.baseAmount.toLocaleString()}`
        : ''
    }</p>
    <div class="sum">
      <div>出工天數<br/><strong>${summary.workDays}</strong></div>
      <div>應領<br/><strong>NT$${summary.confirmedTotal.toLocaleString()}</strong></div>
      <div>實領<br/><strong>NT$${summary.paidTotal.toLocaleString()}</strong></div>
      <div>尚未支付<br/><strong>NT$${summary.unpaidTotal.toLocaleString()}</strong></div>
    </div>
    <h2 style="font-size:14px">明細</h2>
    <table><thead><tr><th>日期</th><th>類別</th><th>項目</th><th>金額</th><th>狀態</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">無</td></tr>'}</tbody></table>
    <h2 style="font-size:14px;margin-top:16px">付款紀錄</h2>
    <table><thead><tr><th>支付日</th><th>金額</th><th>備註</th></tr></thead>
    <tbody>${pays || '<tr><td colspan="3">無</td></tr>'}</tbody></table>
    </body></html>`
  const blob = await htmlPagesToPdfBlob([html])
  downloadBlob(blob, sanitizeFilename(filenameBase || '薪資單') + '.pdf')
}
