import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: null,
}))

describe('safeNotify non-blocking', () => {
  it('does not throw when supabase is not configured', async () => {
    const { safeNotify, safeNotifyApprovers } = await import('./lineNotify')
    await expect(
      safeNotify({
        recipientIds: ['u1'],
        eventType: 'purchase.approved',
        title: 't',
      }),
    ).resolves.toBeUndefined()
    await expect(
      safeNotifyApprovers({
        eventType: 'purchase.pending',
        title: 't',
      }),
    ).resolves.toBeUndefined()
  })
})
