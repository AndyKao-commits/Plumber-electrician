/** Open turn-by-turn navigation to a free-text address (Google Maps). */

export function mapsNavigationUrl(address: string): string | null {
  const q = address.trim()
  if (!q) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`
}
