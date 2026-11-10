import { describe, expect, it } from 'vitest'
import {
  LINE_PUSH_MAX_ATTEMPTS,
  nextOutboxAfterFailure,
  notifyMustNotBlockMainFlow,
  sanitizeLineError,
} from './lineOutboxRetry'

describe('LINE outbox retry policy', () => {
  it('keeps pending for retry until max attempts', () => {
    const r1 = nextOutboxAfterFailure({ attemptsAfter: 1, nowMs: 0 })
    expect(r1.status).toBe('pending')
    expect(r1.nextRetryAt).toBeTruthy()

    const rMax = nextOutboxAfterFailure({
      attemptsAfter: LINE_PUSH_MAX_ATTEMPTS,
      nowMs: 0,
    })
    expect(rMax.status).toBe('failed')
    expect(rMax.nextRetryAt).toBeNull()
  })

  it('redacts tokens from error text', () => {
    const raw =
      'Authorization: Bearer abc.def.ghi LINE_CHANNEL_ACCESS_TOKEN=supersecret eyJhbGciOiJIUzI1NiJ9.aaa.bbb'
    const clean = sanitizeLineError(raw)
    expect(clean).not.toMatch(/supersecret/)
    expect(clean).not.toMatch(/abc\.def\.ghi/)
    expect(clean).toContain('[REDACTED]')
  })

  it('notify failure must not block main flow contract', () => {
    expect(notifyMustNotBlockMainFlow()).toBe(true)
  })
})
