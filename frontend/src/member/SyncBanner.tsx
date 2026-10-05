import { useOutbox } from '@/api/useOutbox'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'

// Shows when the member is offline or has writes waiting to sync. Kept small and
// unobtrusive at the top of the member content column.
export function SyncBanner() {
  const { count, online, syncing, flush } = useOutbox()
  if (online && count === 0) return null

  return (
    <div
      className={`mx-5 mt-3 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] md:mx-0 ${
        online ? 'border-green-100 bg-green-50 text-green' : 'border-gold-50 bg-gold-50 text-gold-deep'
      }`}
    >
      {syncing ? (
        <Spinner className="size-4" />
      ) : (
        <Icon name={online ? 'cloud_sync' : 'cloud_off'} size={18} />
      )}
      <span className="flex-1 font-medium">
        {!online
          ? `You're offline${count ? ` · ${count} change${count > 1 ? 's' : ''} will sync when you reconnect` : ''}`
          : syncing
            ? 'Syncing your changes…'
            : `${count} change${count > 1 ? 's' : ''} waiting to sync`}
      </span>
      {online && !syncing && count > 0 && (
        <button onClick={flush} className="font-semibold underline">
          Sync now
        </button>
      )}
    </div>
  )
}
