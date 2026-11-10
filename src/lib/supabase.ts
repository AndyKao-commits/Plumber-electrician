import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from './supabaseConfig'

const url = resolveSupabaseUrl()
const anonKey = resolveSupabaseAnonKey()

export const supabaseUrl = url
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null
