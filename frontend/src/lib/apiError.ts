import type { AxiosError } from 'axios'

/**
 * Turn an API failure into something a person can act on.
 *
 * DRF reports validation problems as `{field: ["reason", ...]}` and other
 * failures as `{detail: "..."}`. Showing a generic "could not save" throws that
 * away and leaves the user — and whoever is debugging — with nothing to go on.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as AxiosError)?.response?.data as
    | Record<string, unknown>
    | string
    | undefined

  if (typeof data === 'string' && data.trim()) return data.slice(0, 300)

  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') return data.detail

    // First field error wins — but say *which* field. DRF answers
    // {"gl_account": ["This field is required."]}, and that message on its own
    // is unattributable when the form shows every visible field filled in.
    for (const [field, value] of Object.entries(data)) {
      const first =
        typeof value === 'string'
          ? value
          : Array.isArray(value) && typeof value[0] === 'string'
            ? value[0]
            : null
      if (first == null) continue
      if (field === 'detail' || field === 'non_field_errors') return first
      const label = field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
      return `${label}: ${first}`
    }
  }

  const status = (error as AxiosError)?.response?.status
  if (status === 413) return 'That file is too large for the server to accept.'
  if (status) return `${fallback} (HTTP ${status})`
  return fallback
}
