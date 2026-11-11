import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clearPostLoginRedirect } from '@/components/RequireAuth'
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

  const signUpMutation = useMutation({
    mutationFn: async (input: {
      name: string
      email: string
      password: string
      organizationName?: string | null
    }) => {
      if (!formal) throw new Error('本機示範模式請直接選擇示範身分')
      return supabaseRepos.signUp(input)
    },
    onSuccess: (user) => queryClient.setQueryData(userKeys.me(), user),
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      clearPostLoginRedirect()
      if (formal) await supabaseRepos.signOut()
      localDb.setSessionUserId(null)
    },
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(userKeys.me(), null)
    },
  })

  const bindLineMutation = useMutation({
    mutationFn: async (lineUserId: string | null) => {
      if (!formal) throw new Error('本機示範模式不支援 LINE 綁定寫入正式庫')
      return supabaseRepos.bindLineUserId(lineUserId)
    },
    onSuccess: (user) => queryClient.setQueryData(userKeys.me(), user),
  })

  const createLineBindCodeMutation = useMutation({
    mutationFn: async () => {
      if (!formal) throw new Error('本機示範模式不支援 LINE 綁定碼')
      return supabaseRepos.createLineBindCode()
    },
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
    signUp: signUpMutation.mutateAsync,
    signUpError: signUpMutation.error
      ? new Error(toUserMessage(signUpMutation.error))
      : null,
    isSigningUp: signUpMutation.isPending,
    isLoggingIn: loginLocal.isPending || loginPassword.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    bindLineUserId: bindLineMutation.mutateAsync,
    isBindingLine: bindLineMutation.isPending,
    bindLineError: bindLineMutation.error
      ? new Error(toUserMessage(bindLineMutation.error))
      : null,
    createLineBindCode: createLineBindCodeMutation.mutateAsync,
    isCreatingLineBindCode: createLineBindCodeMutation.isPending,
    createLineBindCodeError: createLineBindCodeMutation.error
      ? new Error(toUserMessage(createLineBindCodeMutation.error))
      : null,
    isDemoMode: !formal,
    isFormalMode: formal,
  }
}
