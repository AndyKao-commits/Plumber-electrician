import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const photoKeys = {
  all: ['photos'] as const,
  list: (siteId?: string | null) =>
    [...photoKeys.all, 'list', siteId ?? 'all'] as const,
}

export function usePhotos(siteId?: string | null) {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const listQuery = useQuery({
    queryKey: photoKeys.list(siteId),
    enabled: formal,
    queryFn: async () => supabaseRepos.listPhotoUploads(siteId),
  })

  const linkMutation = useMutation({
    mutationFn: async (input: {
      photoId: string
      siteId: string
      photoType?: string | null
    }) => {
      await supabaseRepos.linkPhotoUpload(
        input.photoId,
        input.siteId,
        input.photoType,
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.all }),
  })

  const classifyMutation = useMutation({
    mutationFn: async (input: { photoId: string; photoType: string }) => {
      await supabaseRepos.classifyPhotoUpload(input.photoId, input.photoType)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.all }),
  })

  const discardMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await supabaseRepos.discardPhotoUpload(photoId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.all }),
  })

  const uploadMutation = useMutation({
    mutationFn: async (input: {
      file: File
      siteId?: string | null
      photoType?: string | null
    }) => {
      return supabaseRepos.uploadAppPhoto(input)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.all }),
  })

  return {
    photos: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error ? new Error(toUserMessage(listQuery.error)) : null,
    refetch: listQuery.refetch,
    linkPhoto: linkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
    classifyPhoto: classifyMutation.mutateAsync,
    isClassifying: classifyMutation.isPending,
    discardPhoto: discardMutation.mutateAsync,
    isDiscarding: discardMutation.isPending,
    uploadPhoto: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error
      ? new Error(toUserMessage(uploadMutation.error))
      : null,
  }
}
