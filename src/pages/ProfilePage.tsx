import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser, userKeys } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { dataModeLabel } from '@/lib/dataMode'

export function ProfilePage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const queryClient = useQueryClient()
  const isBoss = user?.role === 'boss'

  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [hiredAt, setHiredAt] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const directoryQuery = useQuery({
    queryKey: [...userKeys.directory(), 'formal'],
    enabled: Boolean(user && isBoss),
    queryFn: async () => {
      if (!user) return []
      if (formal) return supabaseRepos.listOrgProfiles(user)
      return localDb.getUsers()
    },
  })

  useEffect(() => {
    if (!user) return
    setName(user.name ?? '')
    setNickname(user.nickname ?? '')
    setBirthDate(user.birthDate ?? '')
    setJobTitle(user.jobTitle ?? '')
    setHiredAt(user.hiredAt ?? '')
    setNotes(user.notes ?? '')
  }, [user])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('尚未登入')
      const input = {
        name,
        nickname,
        birthDate: birthDate || null,
        jobTitle,
        hiredAt: hiredAt || null,
        notes,
      }
      return formal
        ? supabaseRepos.updateProfile(user, user.id, input)
        : localDb.updateProfile(user, user.id, input)
    },
    onSuccess: (next) => {
      queryClient.setQueryData(userKeys.me(), next)
      setSaved(true)
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (input: {
      targetUserId: string
      accountStatus: 'active' | 'disabled'
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.updateProfile(user, input.targetUserId, {
            accountStatus: input.accountStatus,
          })
        : localDb.updateProfile(user, input.targetUserId, {
            accountStatus: input.accountStatus,
          })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.directory() })
      void directoryQuery.refetch()
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    await saveMutation.mutateAsync()
  }

  if (!user) return <div className="empty">請先登入</div>

  const hiredLocked = Boolean(user.hiredAt) && !isBoss

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>個人資料</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              員工可修改姓名、暱稱、生日、工種與備註。到職日首次填寫後鎖定，僅老闆可再改。
            </p>
          </div>
          <span className="badge steel">{dataModeLabel()}</span>
        </div>
      </section>

      <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="pf-name">姓名</label>
          <input
            id="pf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pf-nick">暱稱</label>
          <input
            id="pf-nick"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-birth">生日</label>
            <input
              id="pf-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-hired">到職日</label>
            <input
              id="pf-hired"
              type="date"
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
              disabled={hiredLocked}
            />
            {hiredLocked ? (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                已鎖定。若需更正請聯絡老闆。
              </p>
            ) : !isBoss ? (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                首次儲存後不可自行修改。
              </p>
            ) : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor="pf-job">工種／職稱</label>
          <input
            id="pf-job"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="例如：水電、泥作"
          />
        </div>
        <div className="field">
          <label htmlFor="pf-notes">備註</label>
          <input
            id="pf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          帳號狀態：{user.accountStatus === 'disabled' ? '停用' : '啟用'}
        </p>
        <button
          className="btn btn-steel"
          type="submit"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? '儲存中…' : '儲存個人資料'}
        </button>
        {saveMutation.error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {toUserMessage(saveMutation.error)}
          </p>
        ) : null}
        {saved ? <p className="muted" style={{ margin: 0 }}>已儲存</p> : null}
      </form>

      {isBoss ? (
        <section className="panel stack">
          <strong>團隊帳號（停用）</strong>
          {(directoryQuery.data ?? [])
            .filter((m) => m.id !== user.id)
            .map((m) => (
              <div key={m.id} className="row between" style={{ gap: 8 }}>
                <div>
                  <strong style={{ margin: 0 }}>{m.name}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {m.jobTitle || '未填工種'} ·{' '}
                    {m.accountStatus === 'disabled' ? '停用' : '啟用'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    void statusMutation.mutateAsync({
                      targetUserId: m.id,
                      accountStatus:
                        m.accountStatus === 'disabled' ? 'active' : 'disabled',
                    })
                  }
                >
                  {m.accountStatus === 'disabled' ? '啟用' : '停用'}
                </button>
              </div>
            ))}
        </section>
      ) : null}
    </div>
  )
}
