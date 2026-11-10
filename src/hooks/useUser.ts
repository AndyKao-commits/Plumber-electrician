import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppUser, UserRole } from '@/domain/types'
import { localDb } from '@/lib/localDb'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const userKeys = {
  all: ['user'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  directory: () => [...userKeys.all, 'directory'] as const,
}

function mapProfile(row: {
  id: string
  organization_id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  pay_type: AppUser['payType'] | null
  line_user_id: string | null
  finance_authorized: boolean | null
  created_at: string
}, fallbackEmail?: string): AppUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    role: row.role as UserRole,
    email: row.email ?? fallbackEmail,
    phone: row.phone ?? undefined,
    payType: row.pay_type ?? undefined,
    lineUserId: row.line_user_id,
    financeAuthorized: Boolean(row.finance_authorized),
    createdAt: row.created_at,
  }
}

async function fetchCurrentUser(): Promise<AppUser | null> {
  if (isSupabaseConfigured && supabase) {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, created_at',
      )
      .eq('id', auth.user.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    return mapProfile(data, auth.user.email ?? undefined)
  }

  const sessionId = localDb.getSessionUserId()
  if (!sessionId) return null
  return localDb.getUser(sessionId)
}

async function fetchDirectory(): Promise<AppUser[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, created_at',
      )
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map((row) => mapProfile(row))
  }

  return localDb.getUsers()
}

async function loginAsLocal(userId: string): Promise<AppUser> {
  const user = localDb.getUser(userId)
  if (!user) throw new Error('找不到此使用者')
  localDb.setSessionUserId(user.id)
  return user
}

async function loginWithPassword(input: {
  email: string
  password: string
}): Promise<AppUser> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('尚未設定 Supabase anon key')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })
  if (error) throw error
  if (!data.user) throw new Error('登入失敗')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, organization_id, name, role, email, phone, pay_type, line_user_id, finance_authorized, created_at',
    )
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) {
    throw new Error('帳號已登入，但尚未建立 profiles 資料列')
  }

  return mapProfile(profile, data.user.email ?? undefined)
}

async function logoutCurrent(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut()
  }
  localDb.setSessionUserId(null)
}

/**
 * Current signed-in user via React Query.
 * Falls back to local demo accounts when Supabase anon key is not configured.
 */
export function useUser() {
  const queryClient = useQueryClient()

  const userQuery = useQuery({
    queryKey: userKeys.me(),
    queryFn: fetchCurrentUser,
  })

  const directoryQuery = useQuery({
    queryKey: userKeys.directory(),
    queryFn: fetchDirectory,
    enabled: !isSupabaseConfigured,
  })

  const loginMutation = useMutation({
    mutationFn: loginAsLocal,
    onSuccess: (user) => {
      queryClient.setQueryData(userKeys.me(), user)
    },
  })

  const passwordLoginMutation = useMutation({
    mutationFn: loginWithPassword,
    onSuccess: (user) => {
      queryClient.setQueryData(userKeys.me(), user)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: logoutCurrent,
    onSuccess: () => {
      queryClient.setQueryData(userKeys.me(), null)
    },
  })

  return {
    user: userQuery.data ?? null,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    error: userQuery.error,
    refetch: userQuery.refetch,
    directory: directoryQuery.data ?? [],
    loginAs: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending || passwordLoginMutation.isPending,
    loginWithPassword: passwordLoginMutation.mutateAsync,
    passwordLoginError: passwordLoginMutation.error,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    isDemoMode: !isSupabaseConfigured,
  }
}
