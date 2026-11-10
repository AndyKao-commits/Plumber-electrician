import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppUser } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const userKeys = {
  all: ['user'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  directory: () => [...userKeys.all, 'directory'] as const,
}

async function fetchCurrentUser(): Promise<AppUser | null> {
  if (isFormalMode()) return supabaseRepos.getCurrentUser()
  const sessionId = localDb.getSessionUserId()
  if (!sessionId) return null
  return localDb.getUser(sessionId)
}

export function useUser() {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const userQuery = useQuery({
    queryKey: userKeys.me(),
    queryFn: fetchCurrentUser,
  })

  const directoryQuery = useQuery({
    queryKey: userKeys.directory(),
    enabled: !formal,
    queryFn: async () => localDb.getUsers(),
  })

  const loginLocal = useMutation({
    mutationFn: async (userId: string) => {
      if (formal) throw new Error('正式模式請使用 Email／密碼登入')
      const user = localDb.getUser(userId)
      if (!user) throw new Error('找不到此使用者')
      localDb.setSessionUserId(user.id)
      return user
    },
    onSuccess: (user) => queryClient.setQueryData(userKeys.me(), user),
  })

  const loginPassword = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      if (!formal) throw new Error('本機示範模式不支援密碼登入')
      return supabaseRepos.signIn(input.email, input.password)
    },
    onSuccess: (user) => queryClient.setQueryData(userKeys.me(), user),
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (formal) await supabaseRepos.signOut()
      localDb.setSessionUserId(null)
      queryClient.clear()
    },
    onSuccess: () => queryClient.setQueryData(userKeys.me(), null),
  })

  return {
    user: userQuery.data ?? null,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    error: userQuery.error,
    refetch: userQuery.refetch,
    directory: directoryQuery.data ?? [],
    loginAs: loginLocal.mutateAsync,
    loginWithPassword: loginPassword.mutateAsync,
    passwordLoginError: loginPassword.error
      ? new Error(toUserMessage(loginPassword.error))
      : null,
    isLoggingIn: loginLocal.isPending || loginPassword.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    isDemoMode: !formal,
    isFormalMode: formal,
  }
}
