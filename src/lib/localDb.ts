import type { AppUser, AttendanceRecord, SiteProject } from '@/domain/types'

const KEYS = {
  sessionUserId: 'eg.sessionUserId',
  users: 'eg.users',
  sites: 'eg.sites',
  attendance: 'eg.attendance',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const emptyUsers: AppUser[] = []
const emptySites: SiteProject[] = []
const emptyAttendance: AttendanceRecord[] = []

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function seedIfNeeded() {
  const users = read(KEYS.users, emptyUsers)
  if (users.length > 0) return

  const now = new Date().toISOString()
  const seededUsers: AppUser[] = [
    {
      id: 'user-boss',
      name: '老闆',
      role: 'boss',
      email: 'boss@example.com',
      payType: 'monthly',
      createdAt: now,
    },
    {
      id: 'user-worker',
      name: '師傅阿明',
      role: 'employee',
      email: 'ming@example.com',
      payType: 'daily',
      createdAt: now,
    },
  ]

  const seededSites: SiteProject[] = [
    {
      id: 'site-a',
      name: '忠孝東路住家整修',
      kind: 'formal',
      status: 'active',
      address: '台北市大安區忠孝東路四段',
      customerName: '林先生',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'site-b',
      name: '臨時漏水維修',
      kind: 'repair',
      status: 'active',
      address: '新北市板橋區文化路',
      customerName: '陳小姐',
      createdAt: now,
      updatedAt: now,
    },
  ]

  write(KEYS.users, seededUsers)
  write(KEYS.sites, seededSites)
  write(KEYS.attendance, emptyAttendance)
}

seedIfNeeded()

export const localDb = {
  getUsers(): AppUser[] {
    return read(KEYS.users, emptyUsers)
  },

  getUser(id: string): AppUser | null {
    return this.getUsers().find((u) => u.id === id) ?? null
  },

  getSessionUserId(): string | null {
    return localStorage.getItem(KEYS.sessionUserId)
  },

  setSessionUserId(id: string | null) {
    if (!id) localStorage.removeItem(KEYS.sessionUserId)
    else localStorage.setItem(KEYS.sessionUserId, id)
  },

  getSites(): SiteProject[] {
    return read(KEYS.sites, emptySites).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
  },

  getSite(id: string): SiteProject | null {
    return this.getSites().find((s) => s.id === id) ?? null
  },

  upsertSite(site: SiteProject) {
    const sites = this.getSites().filter((s) => s.id !== site.id)
    sites.unshift(site)
    write(KEYS.sites, sites)
  },

  getAttendance(): AttendanceRecord[] {
    return read(KEYS.attendance, emptyAttendance)
  },

  getOpenAttendance(userId: string): AttendanceRecord | null {
    return (
      this.getAttendance().find(
        (a) => a.userId === userId && a.status === 'clocked_in',
      ) ?? null
    )
  },

  saveAttendance(record: AttendanceRecord) {
    const all = this.getAttendance().filter((a) => a.id !== record.id)
    all.unshift(record)
    write(KEYS.attendance, all)
  },
}
