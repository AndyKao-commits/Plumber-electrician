import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  effectiveFeatures,
  emptyFeatures,
  hasFeature,
  type FeatureKey,
  type FeatureMap,
} from '@/domain/featureAccess'
import { assertPhoneAccount } from '@/domain/loginIdentity'
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

function FeatureChecklist(props: {
  value: FeatureMap
  onChange: (next: FeatureMap) => void
  disabledKeys?: FeatureKey[]
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {FEATURE_KEYS.map((key) => (
        <label key={key} className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={props.value[key]}
            disabled={props.disabledKeys?.includes(key)}
            onChange={(e) =>
              props.onChange({ ...props.value, [key]: e.target.checked })
            }
          />
          <span>{FEATURE_LABELS[key]}</span>
        </label>
      ))}
    </div>
  )
}

export function AccessPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const queryClient = useQueryClient()
  const isBoss = user?.role === 'boss'
  const canManageAccounts = hasFeature(user, 'account')

  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [createMessage, setCreateMessage] = useState<string | null>(null)

  const [customName, setCustomName] = useState('')
  const [customTemplate, setCustomTemplate] =
    useState<RoleGroupTemplate>('member')
  const [draftFeatures, setDraftFeatures] = useState<FeatureMap>(
    () => templateToAccessFields('member').features,
  )
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editFeatures, setEditFeatures] = useState<FeatureMap>(emptyFeatures())
  const [overrideUserId, setOverrideUserId] = useState<string | null>(null)
  const [overrideDraft, setOverrideDraft] = useState<FeatureMap>(emptyFeatures())

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

  const createMember = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('尚未登入')
      const name = newName.trim()
      if (!name) throw new Error('請填寫姓名')
      const phone = assertPhoneAccount(newPhone)
      if (!formal) {
        throw new Error('示範模式請直接選擇示範身分；正式開帳需連線資料庫')
      }
      return supabaseRepos.createMemberAccount(user, { name, phone })
    },
    onSuccess: (result) => {
      setNewName('')
      setNewPhone('')
      setCreateMessage(result.message)
      void queryClient.invalidateQueries({ queryKey: userKeys.directory() })
      void directoryQuery.refetch()
    },
  })

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('尚未登入')
      const name = customName.trim()
      if (!name) throw new Error('請輸入身分組名稱')
      const fields = templateToAccessFields(customTemplate)
      const input: Omit<RoleGroupDefinition, 'id' | 'builtIn'> = {
        name,
        template: customTemplate,
        financeAuthorized: fields.financeAuthorized,
        features: draftFeatures,
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

  const saveGroupFeatures = useMutation({
    mutationFn: async () => {
      if (!user || !editGroupId) throw new Error('尚未選擇身分組')
      return formal
        ? supabaseRepos.updateRoleGroupFeatures(user, editGroupId, editFeatures)
        : localDb.updateRoleGroupFeatures(editGroupId, editFeatures)
    },
    onSuccess: () => {
      setEditGroupId(null)
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
            roleGroupId: input.group.builtIn ? null : input.group.id,
            roleGroupName: input.group.name,
            accessTemplate: fields.accessTemplate,
            financeAuthorized: fields.financeAuthorized,
            features: input.group.features,
            permissionOverrides: null,
          })
        : localDb.setMemberAccess(user, input.targetUserId, {
            roleGroupId: input.group.id,
            roleGroupName: input.group.name,
            accessTemplate: fields.accessTemplate,
            financeAuthorized: fields.financeAuthorized,
            features: input.group.features,
            permissionOverrides: null,
          })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.directory() })
      void directoryQuery.refetch()
    },
  })

  const saveOverrides = useMutation({
    mutationFn: async () => {
      if (!user || !overrideUserId) throw new Error('尚未選擇成員')
      const member = (directoryQuery.data ?? []).find((m) => m.id === overrideUserId)
      if (!member) throw new Error('找不到成員')
      const group =
        groups.find((g) => g.id === member.roleGroupId) ||
        groups.find((g) => g.name === member.roleGroupName) ||
        BUILTIN_ROLE_GROUPS.find((g) => g.template === 'member')!
      const fields = templateToAccessFields(group.template)
      const base = effectiveFeatures({
        role: member.role,
        accessTemplate: member.accessTemplate,
        features: group.features,
      })
      const overrides: Partial<FeatureMap> = {}
      for (const key of FEATURE_KEYS) {
        if (overrideDraft[key] !== base[key]) overrides[key] = overrideDraft[key]
      }
      return formal
        ? supabaseRepos.setMemberAccess(user, overrideUserId, {
            roleGroupId: group.builtIn ? null : group.id,
            roleGroupName: group.name,
            accessTemplate:
              fields.accessTemplate === 'owner' ? 'member' : fields.accessTemplate,
            financeAuthorized: Boolean(member.financeAuthorized),
            features: group.features,
            permissionOverrides: overrides,
          })
        : localDb.setMemberAccess(user, overrideUserId, {
            roleGroupId: group.id,
            roleGroupName: group.name,
            accessTemplate:
              fields.accessTemplate === 'owner' ? 'member' : fields.accessTemplate,
            financeAuthorized: Boolean(member.financeAuthorized),
            features: group.features,
            permissionOverrides: overrides,
          })
    },
    onSuccess: () => {
      setOverrideUserId(null)
      void queryClient.invalidateQueries({ queryKey: userKeys.directory() })
      void directoryQuery.refetch()
    },
  })

  if (!user) return <div className="empty">請先登入</div>
  if (!canManageAccounts) {
    return (
      <div className="panel stack">
        <strong>帳號與管理</strong>
        <p className="muted" style={{ margin: 0 }}>
          僅老闆或擁有帳號管理權限者可協助註冊新帳號。
        </p>
        <Link to="/profile">回個人中心</Link>
      </div>
    )
  }

  const members = (directoryQuery.data ?? []).filter((m) => m.id !== user.id)

  function onCreateSubmit(e: FormEvent) {
    e.preventDefault()
    setCreateMessage(null)
    void createMember.mutateAsync().catch(() => undefined)
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <Link to="/profile" className="muted">
          ← 個人中心
        </Link>
        <strong>帳號與管理</strong>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          協助註冊新帳號。預設帳號與密碼皆為電話，首次登入後須更改密碼。
        </p>
      </section>

      <section className="panel stack">
        <strong>註冊新帳號</strong>
        <form className="stack" onSubmit={onCreateSubmit}>
          <div className="field">
            <label htmlFor="member-name">姓名</label>
            <input
              id="member-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：阿明"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="member-phone">電話（＝帳號／預設密碼）</label>
            <input
              id="member-phone"
              type="tel"
              inputMode="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="例如：0912345678"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMember.isPending}
          >
            {createMember.isPending ? '建立中…' : '建立帳號'}
          </button>
        </form>
        {createMember.error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {toUserMessage(createMember.error)}
          </p>
        ) : null}
        {createMessage ? (
          <p className="muted" style={{ margin: 0 }}>
            {createMessage}
          </p>
        ) : null}
      </section>

      {isBoss ? (
        <>
          <section className="panel stack">
            <strong>權限／身分組</strong>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              老闆帳號為最高管理者，不可被降權。可建立身分組、指派成員，並對個人覆寫權限。
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
                placeholder="例如：工班長、會計"
              />
            </div>
            <div className="field">
              <label htmlFor="rg-template">權限模板</label>
              <select
                id="rg-template"
                value={customTemplate}
                onChange={(e) => {
                  const t = e.target.value as RoleGroupTemplate
                  setCustomTemplate(t)
                  setDraftFeatures(templateToAccessFields(t).features)
                }}
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
            <strong style={{ fontSize: '0.95rem' }}>功能權限</strong>
            <FeatureChecklist value={draftFeatures} onChange={setDraftFeatures} />
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
            <strong>既有身分組</strong>
            {groups
              .filter((g) => g.template !== 'owner')
              .map((g) => (
                <div key={g.id} className="site-link stack">
                  <div className="row between">
                    <strong style={{ margin: 0 }}>{g.name}</strong>
                    <span className="badge steel">
                      {ROLE_GROUP_TEMPLATE_LABELS[g.template]}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {FEATURE_KEYS.filter((k) => g.features[k])
                      .map((k) => FEATURE_LABELS[k])
                      .join('、') || '無開啟功能'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditGroupId(g.id)
                      setEditFeatures({ ...g.features })
                    }}
                  >
                    調整功能權限
                  </button>
                  {editGroupId === g.id ? (
                    <div className="stack">
                      <FeatureChecklist
                        value={editFeatures}
                        onChange={setEditFeatures}
                      />
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={saveGroupFeatures.isPending}
                          onClick={() =>
                            void saveGroupFeatures
                              .mutateAsync()
                              .catch(() => undefined)
                          }
                        >
                          {saveGroupFeatures.isPending
                            ? '儲存中…'
                            : '儲存身分組權限'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setEditGroupId(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
          </section>

          <section className="panel stack">
            <strong>套用到成員／個人覆寫</strong>
            {members.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                尚無其他成員
              </p>
            ) : (
              members.map((m) => {
                const eff = effectiveFeatures(m)
                return (
                  <div key={m.id} className="site-link stack">
                    <div className="row between">
                      <strong style={{ margin: 0 }}>{m.name}</strong>
                      <span className="badge steel">
                        {m.roleGroupName || '未指定身分組'}
                      </span>
                    </div>
                    <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                      有效權限：
                      {FEATURE_KEYS.filter((k) => eff[k])
                        .map((k) => FEATURE_LABELS[k])
                        .join('、') || '無'}
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
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setOverrideUserId(m.id)
                        setOverrideDraft(effectiveFeatures(m))
                      }}
                    >
                      調整個人權限覆寫
                    </button>
                    {overrideUserId === m.id ? (
                      <div className="stack">
                        <p
                          className="muted"
                          style={{ margin: 0, fontSize: '0.85rem' }}
                        >
                          勾選＝允許。與身分組不同的項目會存成個人覆寫。
                        </p>
                        <FeatureChecklist
                          value={overrideDraft}
                          onChange={setOverrideDraft}
                        />
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saveOverrides.isPending}
                            onClick={() =>
                              void saveOverrides
                                .mutateAsync()
                                .catch(() => undefined)
                            }
                          >
                            {saveOverrides.isPending
                              ? '儲存中…'
                              : '儲存個人覆寫'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setOverrideUserId(null)}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
            {assignAccess.error || saveOverrides.error ? (
              <p style={{ color: 'var(--danger)', margin: 0 }}>
                {toUserMessage(assignAccess.error || saveOverrides.error)}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
