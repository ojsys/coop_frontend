import type { Member } from '@/api/types'

/** Whether a member matches a typed query — name, number, phone or email. */
export function memberMatches(m: Member, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    m.full_name.toLowerCase().includes(q) ||
    m.member_no.toLowerCase().includes(q) ||
    (m.phone ?? '').toLowerCase().includes(q) ||
    (m.email ?? '').toLowerCase().includes(q)
  )
}
