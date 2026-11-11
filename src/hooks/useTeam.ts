import { useQuery } from '@tanstack/react-query'
import type { TeamPresence } from '@/domain/types'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const teamKeys = {
  all: ['team'] as const,
  today: () => [...teamKeys.all, 'today'] as const,
}

export function useTeam() {
  const formal = isFormalMode()

  const query = useQuery({
    queryKey: teamKeys.today(),
    queryFn: async (): Promise<TeamPresence[]> => {
      try {
        if (formal) return await supabaseRepos.listTeamPresence()
        return localDb.listTeamPresenceToday()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入今日團隊'))
      }
    },
  })

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
