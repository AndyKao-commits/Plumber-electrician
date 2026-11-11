/** Feature-level access controlled by boss via role groups + per-user overrides. */

export const FEATURE_KEYS = [
  'sites',
  'attendance',
  'photos',
  'todos',
  'quotes',
  'expenses',
  'approve',
  'account',
  'site_delete',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  sites: '工地／案件',
  attendance: '出勤',
  photos: '照片',
  todos: '待辦',
  quotes: '報價',
  expenses: '支出／收款',
  approve: '核准（採購／更正等）',
  account: '帳號管理',
  site_delete: '刪除案件',
}

export type FeatureMap = Record<FeatureKey, boolean>

export function emptyFeatures(value = false): FeatureMap {
  return {
    sites: value,
    attendance: value,
    photos: value,
    todos: value,
    quotes: value,
    expenses: value,
    approve: value,
    account: value,
    site_delete: value,
  }
}

/** Built-in templates → default feature sets. */
export function featuresForTemplate(
  template: 'owner' | 'admin' | 'member' | 'finance',
): FeatureMap {
  if (template === 'owner') return emptyFeatures(true)
  if (template === 'admin') {
    return {
      sites: true,
      attendance: true,
      photos: true,
      todos: true,
      quotes: true,
      expenses: true,
      approve: true,
      account: false,
      site_delete: false,
    }
  }
  if (template === 'finance') {
    return {
      sites: true,
      attendance: false,
      photos: false,
      todos: true,
      quotes: true,
      expenses: true,
      approve: false,
      account: false,
      site_delete: false,
    }
  }
  // member / 師傅
  return {
    sites: true,
    attendance: true,
    photos: true,
    todos: true,
    quotes: false,
    expenses: true,
    approve: false,
    account: false,
    site_delete: false,
  }
}

export function mergeFeatures(
  base: FeatureMap,
  overrides?: Partial<FeatureMap> | null,
): FeatureMap {
  const next = { ...base }
  if (!overrides) return next
  for (const key of FEATURE_KEYS) {
    if (typeof overrides[key] === 'boolean') next[key] = overrides[key]!
  }
  return next
}

export function normalizeFeatureMap(
  input?: Partial<FeatureMap> | null,
  fallback?: FeatureMap,
): FeatureMap {
  const base = fallback ?? emptyFeatures(false)
  return mergeFeatures(base, input)
}

export function effectiveFeatures(input: {
  role: string
  accessTemplate?: string | null
  features?: Partial<FeatureMap> | null
  permissionOverrides?: Partial<FeatureMap> | null
}): FeatureMap {
  if (input.role === 'boss' || input.role === 'owner') {
    return emptyFeatures(true)
  }
  const template =
    input.accessTemplate === 'admin' ||
    input.accessTemplate === 'member' ||
    input.accessTemplate === 'owner' ||
    input.accessTemplate === 'finance'
      ? input.accessTemplate
      : 'member'
  const fromTemplate = featuresForTemplate(
    template === 'owner' ? 'admin' : template,
  )
  const fromGroup = mergeFeatures(fromTemplate, input.features)
  return mergeFeatures(fromGroup, input.permissionOverrides)
}

export function hasFeature(
  user: {
    role: string
    accessTemplate?: string | null
    features?: Partial<FeatureMap> | null
    permissionOverrides?: Partial<FeatureMap> | null
  } | null | undefined,
  feature: FeatureKey,
): boolean {
  if (!user) return false
  return effectiveFeatures(user)[feature]
}

export function assertFeature(
  user: {
    role: string
    accessTemplate?: string | null
    features?: Partial<FeatureMap> | null
    permissionOverrides?: Partial<FeatureMap> | null
  },
  feature: FeatureKey,
): void {
  if (!hasFeature(user, feature)) {
    throw new Error(`無權使用「${FEATURE_LABELS[feature]}」`)
  }
}
