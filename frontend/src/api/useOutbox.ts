import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { outbox } from './outbox'
import { useToast } from '@/ui/toast'

// Tracks the offline write queue + connectivity, and flushes on reconnect.
export function useOutbox() {
  const qc = useQueryClient()
  const toast = useToast()
  const [count, setCount] = useState(outbox.count())
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)

  const flush = useCallback(async () => {
    if (!navigator.onLine || outbox.count() === 0) return
    setSyncing(true)
    const { applied } = await outbox.flush()
    setSyncing(false)
    if (applied > 0) {
      qc.invalidateQueries()
      toast(`Synced ${applied} pending change${applied > 1 ? 's' : ''}`)
    }
  }, [qc, toast])

  useEffect(() => outbox.subscribe(() => setCount(outbox.count())), [])

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      flush()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    flush() // attempt on mount (e.g. app reopened after reconnecting)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [flush])

  return { count, online, syncing, flush }
}
