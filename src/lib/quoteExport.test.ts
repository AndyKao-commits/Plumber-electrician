import { describe, expect, it } from 'vitest'
import type { QuoteExportSnapshot } from '@/domain/types'
import {
  buildQuoteCsv,
  buildQuotePrintHtml,
  quotePdfFilename,
} from './quoteExport'

const baseSnap: QuoteExportSnapshot = {
  quoteNumber: 'Q-20261111-ABCD',
  versionNo: 2,
  quoteDate: '2026-11-11',
  title: '廚房配管工程',
  customerName: '王小明',
  siteAddress: '台北市信義區',
  taxMode: 'exclusive',
  taxRate: 0.05,
  items: [
    {
      lineNo: 1,
      kind: 'material',
      description: 'PPR 管材',
      qty: 10,
      unit: '米',
      unitPrice: 100,
      amount: 1000,
    },
    {
      lineNo: 2,
      kind: 'labor',
      description: '工資',
      qty: 1,
      unit: '式',
      unitPrice: 5000,
      amount: 5000,
    },
  ],
  subtotal: 6000,
  discount: 0,
  taxAmount: 300,
  total: 6300,
  paymentTerms: '完工後 7 日',
  validUntil: '2026-12-31',
  notes: '含保固一年',
}

describe('quote PDF／CSV 版面', () => {
  it('檔名格式為 案件_報價單_v版本_日期.pdf', () => {
    expect(quotePdfFilename(baseSnap)).toBe(
      '廚房配管工程_報價單_v2_20261111.pdf',
    )
  })

  it('HTML 含正式報價單結構與繁中標籤', () => {
    const html = buildQuotePrintHtml(baseSnap, {
      companyName: '工程管家',
      contactPhone: '0912-345-678',
      constructionNotes: '需停水施工',
      generatedAtLabel: '2026/11/11 01:00',
    })
    expect(html).toContain('工程報價單')
    expect(html).toContain('報價單編號')
    expect(html).toContain('Q-20261111-ABCD')
    expect(html).toContain('v2')
    expect(html).toContain('王小明')
    expect(html).toContain('PPR 管材')
    expect(html).toContain('報價總金額')
    expect(html).toContain('NT$ 6,300')
    expect(html).toContain('付款方式')
    expect(html).toContain('施工備註')
    expect(html).toContain('版本產生時間')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })

  it('無細項時顯示提示文字', () => {
    const html = buildQuotePrintHtml({ ...baseSnap, items: [] })
    expect(html).toContain('尚未建立報價細項')
  })

  it('多筆細項仍為單一表格（可分頁列印）', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      lineNo: i + 1,
      kind: 'other' as const,
      description: `項目 ${i + 1}`,
      qty: 1,
      unit: '式',
      unitPrice: 100,
      amount: 100,
    }))
    const html = buildQuotePrintHtml({ ...baseSnap, items: many })
    expect(html.match(/<tr>/g)?.length).toBeGreaterThan(40)
    expect(html).toContain('@page { size: A4 portrait')
    expect(html).toContain('page-break-inside: avoid')
  })

  it('CSV 含 BOM 與中文欄位', () => {
    const csv = buildQuoteCsv(baseSnap)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('報價總金額')
    expect(csv).toContain('廚房配管工程')
  })
})
