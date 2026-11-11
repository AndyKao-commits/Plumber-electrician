import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BUILTIN_ROLE_GROUPS,
  ROLE_GROUP_TEMPLATE_LABELS,
  templateToAccessFields,
  type RoleGroupDefinition,
  type RoleGroupTemplate,
} from '@/domain/roleGroups'
import { useUser, userKeys } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'

export function AccessPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const queryClient = useQueryClient()
  const isBoss = user?.role === 'boss'

  const [customName, setCustomName] = useState('')
  const [customTemplate, setCustomTemplate] =
    useState<RoleGroupTemplate>('member')

  const groupsQuery = useQuery({
    queryKey: ['role-groups'],
    enabled: Boolean(user && isBoss),
    queryFn: async () => {
      if (!user) return BUILTIN_ROLE_GROUPS
      if (formal) return supabaseRepos.listRoleGroups(user)
      return localDb.listRoleGroups()
    },
  })

  const directoryQuery = useQuery({
    queryKey: [...userKeys.directory(), 'access'],
    enabled: Boolean(user && isBoss),
    queryFn: async () => {
      if (!user) return []
      if (formal) return supabaseRepos.listOrgProfiles(user)
      return localDb.getUsers()
    },
  })

  const groups = useMemo(() => {
    const custom = groupsQuery.data ?? []
    const ids = new Set(custom.map((g) => g.id))
    return [
      ...BUILTIN_ROLE_GROUPS.filter((g) => !ids.has(g.id)),
      ...custom,
    ]
  }, [groupsQuery.data])

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('尚未登入')
      const name = customName.trim()
      if (!name) throw new Error('請輸入身分組名稱')
      const fields = templateToAccessFields(customTemplate)
      const input: Omit<RoleGroupDefinition, 'id'> = {
        name,
        template: customTemplate,
        financeAuthorized: fields.financeAuthorized,
      }
      return formal
        ? supabaseRepos.createRoleGroup(user, input)
        : localDb.createRoleGroup(input)
    },
    onSuccess: () => {
      setCustomName('')
      void queryClient.invalidateQueries({ queryKey: ['role-groups'] })
    },
  })

  const assignAccess = useMutation({
    mutationFn: async (input: {
      targetUserId: string
      group: RoleGroupDefinition
    }) => {
      if (!user) throw new Error('尚未登入')
      const fields = templateToAccessFields(input.group.template)
      if (fields.accessTemplate === 'owner') {
        throw new Error('不可將他人設為老闆身分')
      }
      return formal
        ? supabaseRepos.setMemberAccess(user, input.targetUserId, {
            roleGroupName: input.group.name,
            accessTemplate: fields.accessTemplate,
            financeAuthorized: fields.financeAuthorized,
          })
        : localDb.setMemberAccess(user, input.targetUserId, {
            roleGroupName: input.group.name,
            accessTemplate: fields.accessTemplate,
            financeAuthorized: fields.financeAuthorized,
          })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.directory() })
      void directoryQuery.refetch()
    },
  })

  if (!user) return <div className="empty">請先登入</div>
  if (!isBoss) {
    return (
      <div className="panel stack">
        <strong>權限設定</strong>
        <p className="muted" style={{ margin: 0 }}>
          僅老闆／管理者可設定身分組與權限。
        </p>
        <Link to="/profile">回個人中心</Link>
      </div>
    )
  }

  const members = (directoryQuery.data ?? []).filter((m) => m.id !== user.id)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <Link to="/profile" className="muted">
          ← 個人中心
        </Link>
        <strong>權限／身分組</strong>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          老闆帳號即管理者。可建立身分組名稱，並套用到團隊成員。
        </p>
      </section>

      <section className="panel stack">
        <strong>建立身分組</strong>
        <div className="field">
          <label htmlFor="rg-name">名稱</label>
          <input
            id="rg-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="例如：工地主任、會計"
          />
        </div>
        <div className="field">
          <label htmlFor="rg-template">權限模板</label>
          <select
            id="rg-template"
            value={customTemplate}
            onChange={(e) =>
              setCustomTemplate(e.target.value as RoleGroupTemplate)
            }
          >
            {(Object.keys(ROLE_GROUP_TEMPLATE_LABELS) as RoleGroupTemplate[])
              .filter((t) => t !== 'owner')
              .map((t) => (
                <option key={t} value={t}>
                  {ROLE_GROUP_TEMPLATE_LABELS[t]}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={createGroup.isPending}
          onClick={() => void createGroup.mutateAsync().catch(() => undefined)}
        >
          {createGroup.isPending ? '建立中…' : '新增身分組'}
        </button>
        {createGroup.error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {toUserMessage(createGroup.error)}
          </p>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>套用到成員</strong>
        {members.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            尚無其他成員
          </p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="site-link stack">
              <div className="row between">
                <strong style={{ margin: 0 }}>{m.name}</strong>
                <span className="badge steel">
                  {m.roleGroupName || '未指定身分組'}
                </span>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {m.jobTitle || '未填工種'}
                {m.financeAuthorized ? ' · 已授權財務' : ''}
                {m.accessTemplate ? ` · ${m.accessTemplate}` : ''}
              </p>
              <div className="field">
                <label htmlFor={`assign-${m.id}`}>指定身分組</label>
                <select
                  id={`assign-${m.id}`}
                  defaultValue=""
                  disabled={assignAccess.isPending}
                  onChange={(e) => {
                    const group = groups.find((g) => g.id === e.target.value)
                    if (!group) return
                    void assignAccess
                      .mutateAsync({ targetUserId: m.id, group })
                      .catch(() => undefined)
                    e.target.value = ''
                  }}
                >
                  <option value="" disabled>
                    選擇身分組…
                  </option>
                  {groups
                    .filter((g) => g.template !== 'owner')
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}（{ROLE_GROUP_TEMPLATE_LABELS[g.template]}）
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))
        )}
        {assignAccess.error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {toUserMessage(assignAccess.error)}
          </p>
        ) : null}
      </section>
    </div>
  )
}
