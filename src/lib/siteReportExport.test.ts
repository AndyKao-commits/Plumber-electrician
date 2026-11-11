import { describe, expect, it } from 'vitest'
import {
  SITE_REPORT_PHOTO_LIMIT,
  assertSiteReportHasContent,
  siteReportPdfFilename,
  type SiteReportInput,
} from './siteReportExport'

describe('site report export', () => {
  it('caps photo limit at 50', () => {
    expect(SITE_REPORT_PHOTO_LIMIT).toBe(50)
  })

  it('builds a safe filename', () => {
    expect(siteReportPdfFilename('福德一路/製造所')).toMatch(
      /^福德一路_製造所_施工報告_\d{8}\.pdf$/,
    )
  })

  it('rejects empty report content', () => {
    const empty: SiteReportInput = {
      site: {
        id: 's1',
        organizationId: 'o1',
        name: '空案',
        kind: 'formal',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        version: 1,
      },
      logs: [],
      reports: [],
      defects: [],
      acceptedQuotes: [],
      photos: [],
      rangeStart: '2026-01-01',
      rangeEnd: '2026-12-31',
    }
    expect(() => assertSiteReportHasContent(empty)).toThrow(/沒有可匯出/)
  })
})
