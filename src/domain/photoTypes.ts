/** V1.0 construction photo classification (LINE + web). */
export type PhotoType =
  | 'before'
  | 'during'
  | 'after'
  | 'acceptance'
  | 'unclassified'

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  before: '施工前',
  during: '施工中',
  after: '施工後',
  acceptance: '驗收',
  unclassified: '尚未分類',
}

export const PHOTO_TYPE_OPTIONS: PhotoType[] = [
  'before',
  'during',
  'after',
  'acceptance',
  'unclassified',
]

export function assertPhotoType(value: string | null | undefined): PhotoType {
  const v = (value || '').trim()
  if (
    v === 'before' ||
    v === 'during' ||
    v === 'after' ||
    v === 'acceptance' ||
    v === 'unclassified'
  ) {
    return v
  }
  throw new Error('請選擇照片類型（施工前／中／後／驗收／尚未分類）')
}

export function groupPhotosByType<T extends { photoType?: PhotoType | null }>(
  photos: T[],
): Record<PhotoType, T[]> {
  const out: Record<PhotoType, T[]> = {
    before: [],
    during: [],
    after: [],
    acceptance: [],
    unclassified: [],
  }
  for (const p of photos) {
    const key = p.photoType || 'unclassified'
    out[key].push(p)
  }
  return out
}
