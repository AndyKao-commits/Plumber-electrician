import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { supabaseRepos } from '@/lib/supabaseRepos'

export const photoKeys = {
  all: ['photos'] as const,
  list: () => [...photoKeys.all, 'list'] as const,
}

export function usePhotos() {
  const queryClient = useQueryClient()
  const formal = isFormalMode()

  const listQuery = useQuery({
    queryKey: photoKeys.list(),
    enabled: formal,
    queryFn: async () => supabaseRepos.listPhotoUploads(),
  })

  const linkMutation = useMutation({
    mutationFn: async (input: { photoId: string; siteId: string }) => {
      await supabaseRepos.linkPhotoUpload(input.photoId, input.siteId)
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
    mutationFn: async (input: { file: File; siteId?: string | null }) => {
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
    discardPhoto: discardMutation.mutateAsync,
    isDiscarding: discardMutation.isPending,
    uploadPhoto: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error
      ? new Error(toUserMessage(uploadMutation.error))
      : null,
  }
}
