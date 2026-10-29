import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

/**
 * Policy pages (terms, privacy, …) as the platform's legal team edits them —
 * /platform-legal/. The public site reads published ones from /public/legal/.
 */

export interface LegalDoc {
  id: number
  slug: string
  title: string
  body: string
  effective_date: string | null
  published: boolean
  order: number
  /** Wired to a route (privacy, terms): editable, never renamed or deleted. */
  fixed: boolean
  created_at: string
  updated_at: string
}

export type LegalDocInput = Pick<LegalDoc, 'slug' | 'title' | 'body' | 'effective_date' | 'published' | 'order'>

export function useLegalDocs() {
  return useQuery({
    queryKey: ['platform-legal'],
    queryFn: async () => (await api.get<LegalDoc[]>('/platform-legal/')).data,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['platform-legal'] })
    // The public pages and footer links read the same documents.
    qc.invalidateQueries({ queryKey: ['legal'] })
    qc.invalidateQueries({ queryKey: ['legal-index'] })
  }
}

export function useSaveLegalDoc() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...input }: LegalDocInput & { id?: number }) =>
      (id
        ? await api.patch<LegalDoc>(`/platform-legal/${id}/`, input)
        : await api.post<LegalDoc>('/platform-legal/', input)
      ).data,
    onSuccess: invalidate,
  })
}

export function useDeleteLegalDoc() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/platform-legal/${id}/`)
    },
    onSuccess: invalidate,
  })
}
