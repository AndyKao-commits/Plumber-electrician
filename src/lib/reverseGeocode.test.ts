import { describe, expect, it, vi, afterEach } from 'vitest'
import { formatTwAddress, reverseGeocode } from './reverseGeocode'

describe('formatTwAddress', () => {
  it('formats city district road house', () => {
    expect(
      formatTwAddress({
        city: '新北市',
        district: '汐止區',
        road: '福德二路',
        houseNumber: '51',
      }),
    ).toBe('新北市 汐止區 福德二路51號')
  })
})

describe('reverseGeocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers Nominatim structured TW address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (url.includes('nominatim')) {
          return {
            ok: true,
            json: async () => ({
              address: {
                house_number: '51號',
                road: '福德二路',
                suburb: '汐止區',
                city: '新北市',
                country: '臺灣',
              },
            }),
          }
        }
        return { ok: false, json: async () => ({}) }
      }),
    )
    const result = await reverseGeocode(25.07, 121.62)
    expect(result?.address).toBe('新北市 汐止區 福德二路51號')
  })

  it('falls back to cleaned BigDataCloud city+district', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (url.includes('nominatim')) {
          return { ok: false, json: async () => ({}) }
        }
        return {
          ok: true,
          json: async () => ({
            locality: '內湖區',
            city: '新北市',
            principalSubdivision: '新北市',
            countryName: '中華民國',
            localityInfo: {
              administrative: [
                { name: '中華民國', adminLevel: 2, order: 2, description: '國家' },
                {
                  name: '新北市',
                  adminLevel: 4,
                  order: 6,
                  description: '中華民國直轄市',
                },
                {
                  name: '臺北市',
                  adminLevel: 4,
                  order: 8,
                  description: '中華民國直轄市暨首都',
                },
                {
                  name: '汐止區',
                  adminLevel: 7,
                  order: 10,
                  description: '臺灣新北市的市轄區',
                },
                {
                  name: '內湖區',
                  adminLevel: 7,
                  order: 11,
                  description: '臺灣臺北市的市轄區',
                },
              ],
              informative: [
                { name: '亚洲' },
                { name: 'Asia/Taipei' },
              ],
            },
          }),
        }
      }),
    )
    const result = await reverseGeocode(25.07, 121.62)
    expect(result?.address).toBe('新北市 汐止區')
    expect(result?.address).not.toMatch(/中華民國|Asia|內湖/)
  })
})
