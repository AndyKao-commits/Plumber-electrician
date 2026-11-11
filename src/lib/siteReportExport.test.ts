import { describe, expect, it } from 'vitest'
import {
  SITE_REPORT_PHOTO_LIMIT,
  siteReportPdfFilename,
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
})
