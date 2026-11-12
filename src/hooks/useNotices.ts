import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const noticeKeys = {
  all: ['notices'] as const,
  list: (userId: string) => [...noticeKeys.all, userId] as const,
}

export function useNotices(userId: string | undefined) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const listQuery = useQuery({
    queryKey: noticeKeys.list(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return []
      try {
        return formal
          ? await supabaseRepos.listNotices(userId)
          : localDb.getNotices(userId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入通知'))
      }
    },
  })

  const invalidate = () => {
    if (!userId) return
    void queryClient.invalidateQueries({ queryKey: noticeKeys.list(userId) })
  }

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      try {
        if (formal) await supabaseRepos.markNoticeRead(id)
        else localDb.markNoticeRead(id)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法標記已讀'))
      }
    },
    onSuccess: invalidate,
  })

  const complete = useMutation({
    mutationFn: async (id: string) => {
      try {
        if (formal) await supabaseRepos.completeNotice(id)
        else localDb.completeNotice(id)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法完成待辦'))
      }
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('尚未登入')
      try {
        if (formal) await supabaseRepos.deleteNotice(userId, id)
        else localDb.deleteNotice(userId, id)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法刪除通知'))
      }
    },
    onSuccess: invalidate,
  })

  const clearRead = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('尚未登入')
      try {
        if (formal) return await supabaseRepos.clearReadNotices(userId)
        return localDb.clearReadNotices(userId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法清除已讀通知'))
      }
    },
    onSuccess: invalidate,
  })

  const notices = listQuery.data ?? []
  return {
    notices,
    todos: notices.filter((n) => n.kind === 'todo' && n.status === 'open'),
    unreadCount: notices.filter((n) => n.unread).length,
    readCount: notices.filter((n) => !n.unread).length,
    isLoading: listQuery.isLoading,
    markRead: markRead.mutateAsync,
    complete: complete.mutateAsync,
    deleteNotice: remove.mutateAsync,
    clearReadNotices: clearRead.mutateAsync,
    isClearingRead: clearRead.isPending,
    isDeleting: remove.isPending,
  }
}
