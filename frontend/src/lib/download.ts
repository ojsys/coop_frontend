import { api } from '@/api/client'

/**
 * Download a file from an authenticated API endpoint (CSV/PDF). Uses the axios
 * client so the token + active-cooperative header are attached, fetches the
 * response as a blob, and triggers a browser save.
 */
export async function downloadFile(
  path: string,
  filename: string,
  params?: Record<string, unknown>,
) {
  const { data } = await api.get(path, { params, responseType: 'blob' })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
