import { api } from './client'

// A persisted queue of member writes made while offline. Each item is replayed
// against the API when connectivity returns. Writes are designed to be
// idempotent server-side (votes dedupe on the unique ballot; contributions
// dedupe on the client-generated psp_reference) so a replay can never double-apply.

export interface OutboxItem {
  id: string
  kind: 'vote' | 'contribute'
  label: string
  url: string
  body: unknown
  cooperativeId: number | null
  createdAt: number
}

const KEY = 'coop.outbox'
const listeners = new Set<() => void>()

function read(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as OutboxItem[]
  } catch {
    return []
  }
}

function write(items: OutboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
  listeners.forEach((l) => l())
}

export const outbox = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  all: read,
  count: () => read().length,

  enqueue(item: Omit<OutboxItem, 'id' | 'createdAt'>) {
    write([
      ...read(),
      { ...item, id: crypto.randomUUID(), createdAt: Date.now() },
    ])
  },

  remove(id: string) {
    write(read().filter((i) => i.id !== id))
  },

  /**
   * Replay queued writes. Stops at the first network/5xx failure (still offline
   * or the server is down) and keeps the remainder queued. A 2xx or 4xx is
   * terminal — the write reached the server (applied, or permanently rejected),
   * so it leaves the queue either way.
   */
  async flush(): Promise<{ applied: number; remaining: number }> {
    let applied = 0
    for (const item of read()) {
      try {
        await api.request({
          method: 'post',
          url: item.url,
          data: item.body,
          // Pin the tenant the write was made under, regardless of the coop
          // that happens to be active at sync time.
          headers: item.cooperativeId
            ? { 'X-Cooperative-Id': String(item.cooperativeId) }
            : undefined,
        })
        outbox.remove(item.id)
        applied++
      } catch (err) {
        const resp = (err as { response?: { status?: number } })?.response
        if (!resp || (resp.status ?? 0) >= 500) break // offline / server down — retry later
        outbox.remove(item.id) // reached the server (idempotent success or hard reject)
        applied++
      }
    }
    return { applied, remaining: read().length }
  },
}
