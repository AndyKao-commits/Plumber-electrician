/** LIFF helpers: init SDK when VITE_LIFF_ID is set; closeWindow back to chat. */

import liff from '@line/liff'

const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || ''

let initPromise: Promise<boolean> | null = null

export function isLiffConfigured(): boolean {
  return Boolean(LIFF_ID)
}

export function getLiffId(): string | null {
  return LIFF_ID || null
}

/** Detect LINE in-app browser (works even before LIFF SDK init). */
export function isLikelyLineWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Line\//i.test(navigator.userAgent)
}

/**
 * Init LIFF once. Returns true when running inside a LIFF context
 * (opened via liff.line.me/… or registered endpoint).
 */
export async function ensureLiffReady(): Promise<boolean> {
  if (!LIFF_ID) return false
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await liff.init({ liffId: LIFF_ID })
        return true
      } catch (err) {
        console.warn('[liff] init failed', err)
        return false
      }
    })()
  }
  return initPromise
}

/** Close LIFF and return to LINE chat. No-op outside LIFF. */
export async function closeLiffWindow(): Promise<{ ok: boolean; reason?: string }> {
  const ready = await ensureLiffReady()
  if (!ready) {
    return {
      ok: false,
      reason: isLikelyLineWebView()
        ? '尚未設定正式 LIFF（請用 liff.line.me 連結開啟）'
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

export const LIFF_PATHS = {
  attendance: '/liff/attendance',
  location: '/liff/location',
} as const

export type LiffEntry = keyof typeof LIFF_PATHS

/** Rich-menu URI when LIFF id is known (falls back to site path). */
export function liffOpenUrl(entry: LiffEntry, appBase: string): string {
  const path = LIFF_PATHS[entry]
  const base = appBase.replace(/\/$/, '')
  if (!LIFF_ID) return `${base}${path}`
  // Endpoint should be site origin; path is appended after LIFF id.
  return `https://liff.line.me/${LIFF_ID}${path}`
}
