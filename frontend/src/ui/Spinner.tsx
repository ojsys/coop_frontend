export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-5 animate-spin rounded-full border-2 border-green/25 border-t-green ${className}`}
    />
  )
}

export function FullscreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-7" />
        <span className="font-mono text-xs tracking-wide text-muted-2">
          CooperativeOS
        </span>
      </div>
    </div>
  )
}
