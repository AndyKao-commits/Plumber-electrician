/** Browser-friendly reverse geocode (no API key). Prefer readable TW address. */

export type ReverseGeocodeResult = {
  address: string
  label: string
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('')
}

function shortenLabel(address: string): string {
  const cleaned = address.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 28) return cleaned
  return `${cleaned.slice(0, 28)}…`
}

/** BigDataCloud free client endpoint (CORS OK). */
async function fromBigDataCloud(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${encodeURIComponent(String(latitude))}` +
    `&longitude=${encodeURIComponent(String(longitude))}` +
    `&localityLanguage=zh`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    locality?: string
    city?: string
    principalSubdivision?: string
    countryName?: string
    localityInfo?: {
      administrative?: Array<{ name?: string; description?: string; order?: number }>
      informative?: Array<{ name?: string; description?: string }>
    }
  }

  const admin = [...(data.localityInfo?.administrative ?? [])].sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99),
  )
  const adminNames = admin
    .map((a) => a.name?.trim())
    .filter((n): n is string => Boolean(n))
  // Prefer TW-style: 縣市 + 區 + 較細層級（去重）
  const uniqueAdmin: string[] = []
  for (const name of adminNames) {
    if (!uniqueAdmin.some((x) => name.includes(x) || x.includes(name))) {
      uniqueAdmin.push(name)
    }
  }

  const informative = (data.localityInfo?.informative ?? [])
    .map((x) => x.name?.trim())
    .filter((n): n is string => Boolean(n))
    .slice(0, 2)

  const address =
    joinParts(uniqueAdmin.length ? uniqueAdmin : [
      data.principalSubdivision,
      data.city,
      data.locality,
    ]) + (informative.length ? ` ${informative.join(' ')}` : '')

  const fallback = joinParts([
    data.principalSubdivision,
    data.city,
    data.locality,
    data.countryName,
  ])
  const finalAddress = (address || fallback).trim()
  if (!finalAddress) return null
  return { address: finalAddress, label: shortenLabel(finalAddress) }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  try {
    return await fromBigDataCloud(latitude, longitude)
  } catch {
    return null
  }
}
