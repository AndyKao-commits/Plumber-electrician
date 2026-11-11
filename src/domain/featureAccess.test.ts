import { describe, expect, it } from 'vitest'
import {
  effectiveFeatures,
  featuresForTemplate,
  hasFeature,
  mergeFeatures,
} from './featureAccess'

describe('featureAccess', () => {
  it('boss always has every feature', () => {
    const f = effectiveFeatures({ role: 'boss' })
    expect(f.site_delete).toBe(true)
    expect(f.account).toBe(true)
  })

  it('member template cannot delete or approve by default', () => {
    const f = featuresForTemplate('member')
    expect(f.photos).toBe(true)
    expect(f.approve).toBe(false)
    expect(f.site_delete).toBe(false)
  })

  it('overrides can grant site_delete', () => {
    const f = effectiveFeatures({
      role: 'employee',
      accessTemplate: 'member',
      permissionOverrides: { site_delete: true },
    })
    expect(f.site_delete).toBe(true)
    expect(hasFeature({ role: 'employee', accessTemplate: 'admin' }, 'approve')).toBe(
      true,
    )
  })

  it('mergeFeatures prefers override values', () => {
    const base = featuresForTemplate('admin')
    expect(mergeFeatures(base, { site_delete: true }).site_delete).toBe(true)
  })
})
