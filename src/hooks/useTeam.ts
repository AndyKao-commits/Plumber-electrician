import { useQuery } from '@tanstack/react-query'
import type { TeamPresence } from '@/domain/types'
import { localDb } from '@/lib/localDb'

export function useTeam() {
  return useQuery({
    queryKey: ['team', 'today'],
    queryFn: async (): Promise<TeamPresence[]> => {
      const users = localDb.getUsers()
      const sites = localDb.getSites()
      return users.map((user) => {
        const open = localDb.getOpenAttendance(user.id)
        const siteName = open?.siteId
          ? sites.find((s) => s.id === open.siteId)?.name
          : open
            ? '尚未選擇工地'
            : null
        return {
          userId: user.id,
          name: user.name,
          clockedIn: Boolean(open),
          siteName,
        }
      })
    },
  })
}
