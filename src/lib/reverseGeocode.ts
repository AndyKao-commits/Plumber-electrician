/** Browser-friendly reverse geocode → short TW address: 縣市 區 路街門牌 */

export type ReverseGeocodeResult = {
  address: string
  label: string
}

type AdminBit = {
  name?: string
  description?: string
  adminLevel?: number
  order?: number
}

const NOISE =
  /^(中華民國|中國台湾|中国台湾|台灣|台湾|臺湾|亞洲|亚洲|Asia\/Taipei|地球|島嶼)/

function norm(s: string): string {
  return s.replace(/台/g, '臺').trim()
}

function isCityLike(name: string): boolean {
  return /[縣市]$/.test(name) && name.length <= 4
}

function isDistrictLike(name: string): boolean {
  return /[區鄉鎮市]$/.test(name) && !isCityLike(name)
}

function isRoadLike(name: string): boolean {
  return /[路街巷道橋]$/.test(name) || /\d+號/.test(name)
}

/** 新北市 汐止區 福德二路51號 */
export function formatTwAddress(parts: {
  city?: string | null
  district?: string | null
  road?: string | null
  houseNumber?: string | null
}): string | null {
  const city = (parts.city ?? '').trim()
  const district = (parts.district ?? '').trim()
  const road = (parts.road ?? '').trim()
  let house = (parts.houseNumber ?? '').trim().replace(/\s+/g, '')
  if (house && !house.endsWith('號') && /^\d+/.test(house)) {
    house = `${house}號`
  }

  const street = `${road}${house}`
  const out = [city, district, street].filter(Boolean).join(' ')
  return out || null
}

function formatFromNominatim(address: Record<string, string | undefined>): string | null {
  const city =
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    address.state ||
    null
  const district =
    address.suburb ||
    address.city_district ||
    address.district ||
    address.quarter ||
    null
  const road = address.road || address.pedestrian || address.footway || null
  const houseNumber = address.house_number || null
  return formatTwAddress({ city, district, road, houseNumber })
}

async function fromNominatim(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2&lat=${encodeURIComponent(String(latitude))}` +
    `&lon=${encodeURIComponent(String(longitude))}` +
    `&accept-language=zh-TW&addressdetails=1`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    address?: Record<string, string | undefined>
  }
  if (!data.address) return null
  const address = formatFromNominatim(data.address)
  if (!address) return null
  return { address, label: address }
}

function pickCity(data: {
  principalSubdivision?: string
  city?: string
  localityInfo?: { administrative?: AdminBit[] }
}): string | null {
  const candidates = [
    data.principalSubdivision,
    data.city,
    ...(data.localityInfo?.administrative ?? [])
      .filter((a) => a.adminLevel === 4)
      .map((a) => a.name),
  ]
  for (const c of candidates) {
    const name = (c ?? '').trim()
    if (name && isCityLike(name) && !NOISE.test(name)) return name
  }
  return null
}

function pickDistrict(
  city: string | null,
  admins: AdminBit[],
  locality?: string | null,
): string | null {
  const cityN = city ? norm(city) : ''
  const districts = admins
    .filter((a) => {
      const name = (a.name ?? '').trim()
      if (!name || !isDistrictLike(name) || NOISE.test(name)) return false
      if ((a.adminLevel ?? 99) < 6) return false
      return true
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  if (cityN) {
    const matched = districts.find((d) => {
      const desc = norm(d.description ?? '')
      return desc.includes(cityN)
    })
    if (matched?.name) return matched.name.trim()
  }

  const loc = (locality ?? '').trim()
  if (loc && isDistrictLike(loc) && !NOISE.test(loc)) {
    // only trust locality if it matches a district tied to city, else skip
    const locOk = districts.some((d) => d.name?.trim() === loc)
    if (locOk) {
      const d = districts.find((x) => x.name?.trim() === loc)
      if (!cityN || norm(d?.description ?? '').includes(cityN)) return loc
    }
  }

  return districts[0]?.name?.trim() || null
}

function pickRoad(informative: AdminBit[]): string | null {
  for (const row of informative) {
    const name = (row.name ?? '').trim()
    if (name && isRoadLike(name) && !NOISE.test(name)) return name
  }
  return null
}

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
    localityInfo?: {
      administrative?: AdminBit[]
      informative?: AdminBit[]
    }
  }

  const admins = data.localityInfo?.administrative ?? []
  const city = pickCity(data)
  const district = pickDistrict(city, admins, data.locality)
  const road = pickRoad(data.localityInfo?.informative ?? [])
  const address = formatTwAddress({ city, district, road })
  if (!address) return null
  return { address, label: address }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  try {
    const nominatim = await fromNominatim(latitude, longitude)
    if (nominatim) return nominatim
  } catch {
    /* fall through */
  }
  try {
    return await fromBigDataCloud(latitude, longitude)
  } catch {
    return null
  }
}
