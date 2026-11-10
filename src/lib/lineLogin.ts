const STATE_KEY = 'line_bind_oauth_state'
export const PENDING_LINE_USER_ID_KEY = 'line_bind_pending_user_id'
const CHANNEL_ID = (import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID as string | undefined)?.trim() || ''

export function isLineLoginConfigured(): boolean {
  return CHANNEL_ID.length > 0
}

export function getLineLoginChannelId(): string {
  return CHANNEL_ID
}

export function getLineBindRedirectUri(): string {
  return `${window.location.origin}/line-bind-callback`
}

/** Start LINE Login OAuth for binding only (not app authentication). */
export function startLineBindLogin(): void {
  if (!CHANNEL_ID) {
    throw new Error('尚未設定 VITE_LINE_LOGIN_CHANNEL_ID')
  }
  const state = crypto.randomUUID().replace(/-/g, '')
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CHANNEL_ID,
    redirect_uri: getLineBindRedirectUri(),
    state,
    scope: 'profile openid',
    bot_prompt: 'aggressive',
  })
  window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`)
}

export function consumeLineBindState(returnedState: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  if (!expected || !returnedState) return false
  return expected === returnedState
}

export function getLineLoginExchangeUrl(): string {
  const base =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://rhpzvqvkmllbdtkpouwn.supabase.co'
  return `${base}/functions/v1/line-login-exchange`
}
