import { AppError } from './errors'

/** Postgres uuid text shape (not strict RFC variant/version). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value))
}

/** Reject demo IDs like site-a before they hit Postgres uuid columns. */
export function requireUuid(
  value: string | null | undefined,
  label = '資料',
): string {
  if (!isUuid(value)) {
    throw new AppError(`${label} ID 無效，請重新選擇後再送出`)
  }
  return value as string
}

export function optionalUuid(
  value: string | null | undefined,
  label = '資料',
): string | null {
  if (value == null || value === '') return null
  return requireUuid(value, label)
}
