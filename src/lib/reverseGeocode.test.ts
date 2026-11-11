import { describe, expect, it, vi, afterEach } from 'vitest'
import { reverseGeocode } from './reverseGeocode'

describe('reverseGeocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds address from BigDataCloud payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          locality: '內湖區',
          city: '台北市',
          principalSubdivision: '台北市',
          countryName: '台灣',
          localityInfo: {
            administrative: [
              { name: '台灣', order: 2 },
              { name: '台北市', order: 4 },
              { name: '內湖區', order: 5 },
              { name: '湖興里', order: 6 },
            ],
            informative: [{ name: '成功路一段' }],
          },
        }),
      })),
    )
    const result = await reverseGeocode(25.07, 121.56)
    expect(result?.address).toContain('台北市')
    expect(result?.address).toContain('內湖區')
    expect(result?.label).toBeTruthy()
  })

  it('returns null on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    expect(await reverseGeocode(1, 2)).toBeNull()
  })
})
