/** LIFF / LINE in-app browser helpers. No push — open pages from rich menu / reply URI. */

const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || ''

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

export const LIFF_PATHS = {
  attendance: '/liff/attendance',
  location: '/liff/location',
} as const

export type LiffEntry = keyof typeof LIFF_PATHS
