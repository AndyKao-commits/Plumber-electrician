import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { localDb } from '@/lib/localDb'

export const noticeKeys = {
  all: ['notices'] as const,
  list: (userId: string) => [...noticeKeys.all, userId] as const,
}

export function useNotices(userId: string | undefined) {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: noticeKeys.list(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return []
      return localDb.getNotices(userId)
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => localDb.markNoticeRead(id),
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({ queryKey: noticeKeys.list(userId) })
    },
  })

  const complete = useMutation({
    mutationFn: async (id: string) => localDb.completeNotice(id),
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({ queryKey: noticeKeys.list(userId) })
    },
  })

  const notices = listQuery.data ?? []
  const unreadCount = notices.filter((n) => n.unread).length
  const todos = notices.filter((n) => n.kind === 'todo' && n.status === 'open')

  return {
    notices,
    todos,
    unreadCount,
    isLoading: listQuery.isLoading,
    markRead: markRead.mutateAsync,
    complete: complete.mutateAsync,
  }
}
