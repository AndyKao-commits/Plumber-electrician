import { supabase } from './supabase'

export type LineNotifyEvent =
  | 'purchase.pending'
  | 'purchase.approved'
  | 'purchase.rejected'
  | 'quote.published'
  | 'attendance.clock_in'
  | 'attendance.clock_out'
  | 'notice.created'

/**
 * Best-effort LINE + in-app fan-out.
 * NEVER throws — callers must not await-fail the main transaction on notify errors.
 */
export async function safeNotify(input: {
  recipientIds: string[]
  eventType: LineNotifyEvent
  title: string
  detail?: string
  href?: string
  asTodo?: boolean
  alsoInApp?: boolean
}): Promise<void> {
  try {
    if (!supabase) return
    const recipients = input.recipientIds.filter(Boolean)
    if (recipients.length === 0) return

    if (input.alsoInApp !== false) {
      const { error: noticeError } = await supabase.rpc('create_org_notices', {
        p_recipient_ids: recipients,
        p_kind: input.asTodo === false ? 'notice' : 'todo',
        p_title: input.title,
        p_detail: input.detail ?? '',
        p_href: input.href ?? null,
        p_as_todo: input.asTodo !== false,
      })
      if (noticeError) {
        console.warn('[notify] in-app notice failed', noticeError.message)
      }
    }

    const { error: outboxError } = await supabase.rpc('enqueue_line_notifications', {
      p_recipient_ids: recipients,
      p_event_type: input.eventType,
      p_title: input.title,
      p_body: input.detail ?? '',
      p_href: input.href ?? null,
      p_payload: { eventType: input.eventType },
    })
    if (outboxError) {
      console.warn('[notify] LINE outbox enqueue failed', outboxError.message)
      return
    }

    // Fire-and-forget Edge Function; missing deploy/token must not break UX
    void supabase.functions
      .invoke('line-push', {
        body: {
          eventType: input.eventType,
          title: input.title,
          body: input.detail ?? '',
          href: input.href,
          recipientIds: recipients,
        },
      })
      .then(({ error }) => {
        if (error) console.warn('[notify] LINE push invoke failed', error.message)
      })
      .catch((err: unknown) => {
        console.warn('[notify] LINE push invoke threw', err)
      })
  } catch (err) {
    console.warn('[notify] safeNotify swallowed error', err)
  }
}

export async function safeNotifyApprovers(input: {
  eventType: LineNotifyEvent
  title: string
  detail?: string
  href?: string
  asTodo?: boolean
}): Promise<void> {
  try {
    if (!supabase) return
    const { data, error } = await supabase.rpc('list_approver_ids', {
      p_exclude_self: true,
    })
    if (error) {
      console.warn('[notify] list_approver_ids failed', error.message)
      return
    }
    const ids = (data as string[] | null) ?? []
    await safeNotify({
      recipientIds: ids,
      eventType: input.eventType,
      title: input.title,
      detail: input.detail,
      href: input.href,
      asTodo: input.asTodo,
    })
  } catch (err) {
    console.warn('[notify] safeNotifyApprovers swallowed error', err)
  }
}
