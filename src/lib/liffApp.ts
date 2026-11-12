/** LIFF helpers — prefer one LIFF app per page (no path hop / double redirect). */

import liff from '@line/liff'

const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || ''
const LIFF_ID_ATTENDANCE =
  (import.meta.env.VITE_LIFF_ID_ATTENDANCE as string | undefined)?.trim() || ''
const LIFF_ID_LOCATION =
  (import.meta.env.VITE_LIFF_ID_LOCATION as string | undefined)?.trim() || ''
const LIFF_ID_EXPENSE =
  (import.meta.env.VITE_LIFF_ID_EXPENSE as string | undefined)?.trim() || ''

export type LiffEntry = 'attendance' | 'location' | 'expense' | 'hub'

export const LIFF_PATHS = {
  hub: '/liff',
  attendance: '/liff/attendance',
  location: '/liff/location',
  expense: '/liff/expense',
} as const

const initById = new Map<string, Promise<boolean>>()

export function getLiffIdFor(entry: LiffEntry = 'hub'): string | null {
  if (entry === 'attendance') return LIFF_ID_ATTENDANCE || LIFF_ID || null
  if (entry === 'location') return LIFF_ID_LOCATION || LIFF_ID || null
  if (entry === 'expense') return LIFF_ID_EXPENSE || LIFF_ID || null
  return (
    LIFF_ID ||
    LIFF_ID_ATTENDANCE ||
    LIFF_ID_LOCATION ||
    LIFF_ID_EXPENSE ||
    null
  )
}

export function isLiffConfigured(entry?: LiffEntry): boolean {
  return Boolean(entry ? getLiffIdFor(entry) : getLiffIdFor('hub'))
}

export function getLiffId(): string | null {
  return getLiffIdFor('hub')
}

/** Detect LINE in-app browser (works even before LIFF SDK init). */
export function isLikelyLineWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Line\//i.test(navigator.userAgent)
}

/**
 * Init LIFF once per id. Returns true when running inside that LIFF context.
 */
export async function ensureLiffReady(
  entry: LiffEntry = 'hub',
): Promise<boolean> {
  const id = getLiffIdFor(entry)
  if (!id) return false
  let pending = initById.get(id)
  if (!pending) {
    pending = (async () => {
      try {
        await liff.init({ liffId: id })
        return true
      } catch (err) {
        console.warn('[liff] init failed', id, err)
        return false
      }
    })()
    initById.set(id, pending)
  }
  return pending
}

/** Close LIFF and return to LINE chat. No-op outside LIFF. */
export async function closeLiffWindow(
  entry: LiffEntry = 'hub',
): Promise<{ ok: boolean; reason?: string }> {
  const ready = await ensureLiffReady(entry)
  if (!ready) {
    return {
      ok: false,
      reason: isLikelyLineWebView()
        ? '尚未用對應的 liff.line.me 連結開啟'
        : '請在 LINE 內開啟此頁再關閉',
    }
  }
  try {
    if (typeof liff.closeWindow === 'function') {
      liff.closeWindow()
      return { ok: true }
    }
  } catch (err) {
    console.warn('[liff] closeWindow failed', err)
  }
  return { ok: false, reason: '目前環境無法關閉，請用 LINE 左上角返回' }
}

/**
 * Prefer dedicated LIFF id → `https://liff.line.me/{id}` (Endpoint = exact page).
 * Fallback shared id with path, then plain site URL.
 */
export function liffOpenUrl(entry: LiffEntry, appBase: string): string {
  const base = appBase.replace(/\/$/, '')
  const path = LIFF_PATHS[entry]
  const dedicated =
    entry === 'attendance'
      ? LIFF_ID_ATTENDANCE
      : entry === 'location'
        ? LIFF_ID_LOCATION
        : entry === 'expense'
          ? LIFF_ID_EXPENSE
          : ''
  if (dedicated) return `https://liff.line.me/${dedicated}`
  if (LIFF_ID) {
    if (entry === 'hub') return `https://liff.line.me/${LIFF_ID}`
    return `https://liff.line.me/${LIFF_ID}/${entry}`
  }
  return `${base}${path}`
}
