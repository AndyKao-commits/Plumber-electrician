export type SiteDeleteImpact = {
  siteId: string
  siteName: string
  photoCount: number
  pendingExpenseCount: number
  confirmedExpenseCount: number
  pendingReceiptCount: number
  confirmedReceiptCount: number
  attendanceCount: number
  quoteCount: number
  defectCount: number
  /** Hard delete blocked when confirmed finance exists. */
  blocked: boolean
  blockReason: string | null
  /** Human-readable handling lines for confirm UI. */
  handlingLines: string[]
}

export function buildSiteDeleteImpact(input: {
  siteId: string
  siteName: string
  photoCount: number
  pendingExpenseCount: number
  confirmedExpenseCount: number
  pendingReceiptCount: number
  confirmedReceiptCount: number
  attendanceCount: number
  quoteCount: number
  defectCount: number
}): SiteDeleteImpact {
  const blocked =
    input.confirmedExpenseCount > 0 || input.confirmedReceiptCount > 0
  const blockReason = blocked
    ? '本案已有已確認的支出或收款紀錄，為保護帳務稽核不可永久刪除。請改用「結案」封存。'
    : null

  const handlingLines: string[] = []
  handlingLines.push(
    input.photoCount > 0
      ? `施工照片 ${input.photoCount} 筆：將連同雲端檔案一併刪除`
      : '施工照片：無',
  )
  handlingLines.push(
    input.defectCount > 0
      ? `缺失紀錄 ${input.defectCount} 筆：隨案件刪除`
      : '缺失紀錄：無',
  )
  handlingLines.push(
    input.quoteCount > 0
      ? `報價 ${input.quoteCount} 筆：軟刪除並解除工地關聯`
      : '報價：無',
  )
  handlingLines.push(
    input.attendanceCount > 0
      ? `出勤 ${input.attendanceCount} 筆：保留紀錄，僅解除工地關聯`
      : '出勤：無',
  )
  const pendingFinance =
    input.pendingExpenseCount + input.pendingReceiptCount
  const confirmedFinance =
    input.confirmedExpenseCount + input.confirmedReceiptCount
  if (confirmedFinance > 0) {
    handlingLines.push(
      `已確認支出／收款共 ${confirmedFinance} 筆：不可刪除 → 請改結案封存`,
    )
  } else if (pendingFinance > 0) {
    handlingLines.push(
      `待審支出／收款共 ${pendingFinance} 筆：保留財務資料，工地標記改為「原案件已刪除」`,
    )
  } else {
    handlingLines.push('支出／收款：無關聯')
  }

  return {
    ...input,
    blocked,
    blockReason,
    handlingLines,
  }
}

export function deletedSiteFinanceLabel(siteName: string): string {
  const base = (siteName || '工地').trim() || '工地'
  if (base.includes('原案件已刪除')) return base
  return `${base}（原案件已刪除）`
}
