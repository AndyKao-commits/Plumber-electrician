import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'

export const customerKeys = {
  all: ['customers'] as const,
  contacts: (customerId: string) =>
    ['customer-contacts', customerId] as const,
  links: ['customer-site-links'] as const,
}

export function useCustomers() {
  const queryClient = useQueryClient()
  const formal = isFormalMode()
  const { user } = useUser()

  const customersQuery = useQuery({
    queryKey: customerKeys.all,
    queryFn: async () => {
      try {
        if (formal) return supabaseRepos.listCustomers()
        return localDb.listCustomers()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入客戶'))
      }
    },
  })

  const linksQuery = useQuery({
    queryKey: customerKeys.links,
    queryFn: async () => {
      try {
        if (formal) return supabaseRepos.listCustomerSiteLinks()
        return localDb.listCustomerSiteLinks()
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入客戶地址關聯'))
      }
    },
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: customerKeys.all })
    void queryClient.invalidateQueries({ queryKey: customerKeys.links })
  }

  const createCustomer = useMutation({
    mutationFn: async (input: {
      name: string
      phone?: string | null
      notes?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.createCustomer(user, input)
        : localDb.createCustomer({ id: user.id }, input)
    },
    onSuccess: invalidate,
  })

  const addContact = useMutation({
    mutationFn: async (input: {
      customerId: string
      name: string
      phone?: string | null
      email?: string | null
      isPrimary?: boolean
      notes?: string | null
    }) => {
      if (!user) throw new Error('尚未登入')
      const result = formal
        ? await supabaseRepos.addCustomerContact(user, input)
        : localDb.addCustomerContact({ id: user.id }, input)
      void queryClient.invalidateQueries({
        queryKey: customerKeys.contacts(input.customerId),
      })
      return result
    },
  })

  const linkSite = useMutation({
    mutationFn: async (input: { customerId: string; siteId: string }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.linkCustomerToSite(user, input)
        : localDb.linkCustomerToSite({ id: user.id }, input)
    },
    onSuccess: invalidate,
  })

  return {
    customers: customersQuery.data ?? [],
    links: linksQuery.data ?? [],
    isLoading: customersQuery.isLoading,
    error: customersQuery.error,
    createCustomer: createCustomer.mutateAsync,
    addContact: addContact.mutateAsync,
    linkSite: linkSite.mutateAsync,
    saving:
      createCustomer.isPending || addContact.isPending || linkSite.isPending,
  }
}

export function useCustomerContacts(customerId: string | undefined) {
  const formal = isFormalMode()
  return useQuery({
    queryKey: customerId
      ? customerKeys.contacts(customerId)
      : ['customer-contacts', 'none'],
    enabled: Boolean(customerId),
    queryFn: async () => {
      if (!customerId) return []
      try {
        if (formal) return supabaseRepos.listCustomerContacts(customerId)
        return localDb.listCustomerContacts(customerId)
      } catch (e) {
        throw new Error(toUserMessage(e, '無法載入聯絡人'))
      }
    },
  })
}
