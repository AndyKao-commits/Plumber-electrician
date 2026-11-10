import { isSupabaseConfigured } from './supabase'

/** Formal mode = Supabase configured. Demo = localDb only. Never mix. */
export function isFormalMode(): boolean {
  return isSupabaseConfigured
}

export function dataModeLabel(): 'Supabase 正式模式' | '本機示範模式' {
  return isFormalMode() ? 'Supabase 正式模式' : '本機示範模式'
}
