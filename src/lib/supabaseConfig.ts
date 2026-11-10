/** Public project URL shared by owner. Anon key stays in secrets / .env.local. */
export const DEFAULT_SUPABASE_URL = 'https://rhpzvqvkmllbdtkpouwn.supabase.co'

export function resolveSupabaseUrl(): string | undefined {
  const fromEnv =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
    (import.meta.env.SUPABASE_URL as string | undefined)?.trim()
  return fromEnv || DEFAULT_SUPABASE_URL
}

export function resolveSupabaseAnonKey(): string | undefined {
  const key =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    (import.meta.env.SUPABASE_ANON_KEY as string | undefined)?.trim()
  return key || undefined
}
