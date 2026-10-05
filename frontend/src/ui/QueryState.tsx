import type { ReactNode } from 'react'
import { Spinner } from './Spinner'
import { ErrorState } from './EmptyState'

// Wrap a react-query result: show a spinner while loading, an error state on
// failure, otherwise the children.
export function QueryState({
  isLoading,
  isError,
  children,
  minHeight = 160,
}: {
  isLoading: boolean
  isError: boolean
  children: ReactNode
  minHeight?: number
}) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center" style={{ minHeight }}>
        <Spinner className="size-7" />
      </div>
    )
  if (isError) return <ErrorState />
  return <>{children}</>
}
