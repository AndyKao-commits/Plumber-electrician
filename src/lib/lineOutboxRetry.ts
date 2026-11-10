/** Pure retry policy mirrored by supabase/functions/line-push (keep in sync). */

export const LINE_PUSH_MAX_ATTEMPTS = 5

export function sanitizeLineError(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._\-/=+]+/gi, 'Bearer [REDACTED]')
    .replace(/LINE_CHANNEL_ACCESS_TOKEN\s*[:=]\s*\S+/gi, 'LINE_CHANNEL_ACCESS_TOKEN=[REDACTED]')
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    .slice(0, 500)
}

export function nextOutboxAfterFailure(input: {
  attemptsAfter: number
  nowMs?: number
}): {
  status: 'pending' | 'failed'
  nextRetryAt: string | null
} {
  const exhausted = input.attemptsAfter >= LINE_PUSH_MAX_ATTEMPTS
  if (exhausted) return { status: 'failed', nextRetryAt: null }
  const now = input.nowMs ?? Date.now()
  const minutes = Math.min(60, 2 ** input.attemptsAfter)
  return {
    status: 'pending',
    nextRetryAt: new Date(now + minutes * 60_000).toISOString(),
  }
}

/** Main transaction must never depend on notify outcome. */
export function notifyMustNotBlockMainFlow(): true {
  return true
}
