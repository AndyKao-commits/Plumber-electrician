import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppUser, UserRole } from '@/domain/types'
import { localDb } from '@/lib/localDb'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const userKeys = {
  all: ['user'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  directory: () => [...userKeys.all, 'directory'] as const,
}

async function fetchCurrentUser(): Promise<AppUser | null> {
  if (isSupabaseConfigured && supabase) {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, email, phone, pay_type, line_user_id, created_at')
      .eq('id', auth.user.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      name: data.name,
      role: data.role as UserRole,
      email: data.email ?? auth.user.email ?? undefined,
      phone: data.phone ?? undefined,
      payType: data.pay_type ?? undefined,
      lineUserId: data.line_user_id,
      createdAt: data.created_at,
    }
  }

  const sessionId = localDb.getSessionUserId()
  if (!sessionId) return null
  return localDb.getUser(sessionId)
}

async function fetchDirectory(): Promise<AppUser[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, email, phone, pay_type, line_user_id, created_at')
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role as UserRole,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      payType: row.pay_type ?? undefined,
      lineUserId: row.line_user_id,
      createdAt: row.created_at,
    }))
  }

  return localDb.getUsers()
}

async function loginAsLocal(userId: string): Promise<AppUser> {
  const user = localDb.getUser(userId)
  if (!user) throw new Error('找不到此使用者')
  localDb.setSessionUserId(user.id)
  return user
}

async function logoutCurrent(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut()
  }
  localDb.setSessionUserId(null)
}

/**
 * Current signed-in user via React Query.
 * Falls back to local demo accounts when Supabase env is not configured.
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
  })

  const loginMutation = useMutation({
    mutationFn: loginAsLocal,
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
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    isDemoMode: !isSupabaseConfigured,
  }
}
