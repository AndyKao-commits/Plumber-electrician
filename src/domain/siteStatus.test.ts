import { describe, expect, it } from 'vitest'
import {
  assertSiteStatusTransition,
  isOpenSiteStatus,
  SITE_STATUS_LABELS,
} from './siteStatus'

describe('siteStatus', () => {
  it('labels cover all statuses', () => {
    expect(SITE_STATUS_LABELS.closed).toBe('已結案')
    expect(isOpenSiteStatus('active')).toBe(true)
    expect(isOpenSiteStatus('closed')).toBe(false)
  })

  it('allows close and reopen', () => {
    expect(() =>
      assertSiteStatusTransition({ from: 'active', to: 'closed' }),
    ).not.toThrow()
    expect(() =>
      assertSiteStatusTransition({ from: 'closed', to: 'active' }),
    ).not.toThrow()
  })

  it('blocks invalid jumps', () => {
    // pending_close is reachable; closed→pending_close is not in matrix
    expect(() =>
      assertSiteStatusTransition({ from: 'closed', to: 'pending_close' }),
    ).toThrow(/無法從/)
  })
})
