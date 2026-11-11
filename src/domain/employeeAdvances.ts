/** Employee advance (代墊) rules. */

export type EmployeeAdvanceStatus = 'open' | 'settled' | 'cancelled'

export const ADVANCE_STATUS_LABELS: Record<EmployeeAdvanceStatus, string> = {
  open: '待核銷',
  settled: '已核銷',
  cancelled: '已取消',
}

export function assertAdvanceItem(value: string): string {
  const item = value.trim()
  if (!item) throw new Error('請填代墊項目')
  if (item.length > 80) throw new Error('代墊項目過長（最多 80 字）')
  return item
}

export function assertCanSettleAdvances(input: {
  actorRole: string
  selectedIds: string[]
}): void {
  if (input.actorRole !== 'boss') {
    throw new Error('僅老闆可核銷代墊')
  }
  if (input.selectedIds.length === 0) {
    throw new Error('請至少選一筆代墊')
  }
}

export function sumAdvanceAmounts(
  rows: Array<{ id: string; amount: number; status: EmployeeAdvanceStatus }>,
  selectedIds: string[],
): number {
  const set = new Set(selectedIds)
  return rows
    .filter((r) => set.has(r.id) && r.status === 'open')
    .reduce((s, r) => s + Number(r.amount || 0), 0)
}

export function buildSettleExpenseItem(count: number): string {
  return `代墊核銷 · ${count} 筆`
}
