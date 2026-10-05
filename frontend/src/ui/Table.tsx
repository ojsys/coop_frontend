import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, i: number) => string | number
  onRowClick?: (row: T) => void
  empty?: ReactNode
}) {
  const alignCls = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-2 ${alignCls(c.align)}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center">
                {empty ?? <span className="text-sm text-muted">No records.</span>}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line/60 last:border-0 ${onRowClick ? 'cursor-pointer transition hover:bg-sand/60' : ''}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 text-ink-soft ${alignCls(c.align)} ${c.className ?? ''}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[13px] text-muted">
      <span>
        Showing {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex size-7 items-center justify-center rounded-md border border-line bg-card disabled:opacity-40 hover:bg-sand"
        >
          ‹
        </button>
        <span className="px-2 font-mono text-xs">
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="flex size-7 items-center justify-center rounded-md border border-line bg-card disabled:opacity-40 hover:bg-sand"
        >
          ›
        </button>
      </div>
    </div>
  )
}
