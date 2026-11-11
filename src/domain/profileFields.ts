/** V1.0 profile field validation. */

export type AccountStatus = 'active' | 'disabled'

export function assertAccountStatus(
  value: string | null | undefined,
): AccountStatus {
  if (value === 'active' || value === 'disabled') return value
  throw new Error('帳號狀態僅能為啟用或停用')
}

export function normalizeProfileFields(input: {
  nickname?: string | null
  birthDate?: string | null
  jobTitle?: string | null
  hiredAt?: string | null
  notes?: string | null
}): {
  nickname: string | null
  birthDate: string | null
  jobTitle: string | null
  hiredAt: string | null
  notes: string | null
} {
  const nickname = input.nickname?.trim() || null
  const jobTitle = input.jobTitle?.trim() || null
  const notes = input.notes?.trim() || null
  const birthDate = normalizeOptionalDate(input.birthDate, '生日')
  const hiredAt = normalizeOptionalDate(input.hiredAt, '到職日')
  if (nickname && nickname.length > 40) throw new Error('暱稱過長（最多 40 字）')
  if (jobTitle && jobTitle.length > 40) throw new Error('工種／職稱過長（最多 40 字）')
  if (notes && notes.length > 500) throw new Error('備註過長（最多 500 字）')
  return { nickname, birthDate, jobTitle, hiredAt, notes }
}

function normalizeOptionalDate(
  value: string | null | undefined,
  label: string,
): string | null {
  const v = value?.trim() || null
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`${label}格式請用 YYYY-MM-DD`)
  }
  const d = new Date(`${v}T00:00:00+08:00`)
  if (Number.isNaN(d.getTime())) throw new Error(`${label}無效`)
  return v
}
