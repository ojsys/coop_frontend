import { useMemo, useState } from 'react'
import { useAnnouncements, useMembers, useRoles } from '@/api/hooks'
import {
  useCreateAnnouncement,
  useSendAnnouncement,
  useDeleteAnnouncement,
} from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import { QueryState } from '@/ui/QueryState'
import { Field, Select } from '@/ui/Field'
import { dateTime } from '@/lib/format'

const CHANNELS = [
  { id: 'in_app', label: 'In-app', icon: 'notifications' },
  { id: 'sms', label: 'SMS', icon: 'sms' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
]

export function AnnouncementsPage() {
  const list = useAnnouncements()
  const create = useCreateAnnouncement()
  const send = useSendAnnouncement()
  const del = useDeleteAnnouncement()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [channels, setChannels] = useState<string[]>(['in_app', 'email'])
  const [audience, setAudience] = useState('all')
  const [roleId, setRoleId] = useState('')
  const { data: members = [] } = useMembers()
  const { data: roles = [] } = useRoles()

  // Live recipient-count preview from the member list.
  const recipients = useMemo(() => {
    const active = members.filter((m) => m.status === 'active')
    if (audience === 'role' && roleId) {
      const role = roles.find((r) => String(r.id) === roleId)
      return active.filter((m) => m.role_name === role?.name).length
    }
    return active.length
  }, [members, roles, audience, roleId])

  function toggle(id: string) {
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  function reset() {
    setTitle('')
    setBody('')
  }

  function payload() {
    return {
      title, body, channels,
      audience,
      audience_role: audience === 'role' && roleId ? Number(roleId) : null,
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const created = await create.mutateAsync(payload())
      await send.mutateAsync(created.id)
      toast(`Broadcast to ${recipients} member${recipients === 1 ? '' : 's'}`)
      reset()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send announcement'), 'error')
    }
  }

  async function saveDraft() {
    if (!title || !body) {
      toast('Add a title and message first', 'error')
      return
    }
    try {
      await create.mutateAsync(payload())
      toast('Draft saved')
      reset()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save draft'), 'error')
    }
  }

  async function sendExisting(id: number) {
    try {
      await send.mutateAsync(id)
      toast('Announcement broadcast to members')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send'), 'error')
    }
  }

  async function remove(id: number) {
    try {
      await del.mutateAsync(id)
      toast('Announcement deleted')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not delete'), 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Broadcast in-app, SMS, email & WhatsApp · members choose channels" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="New announcement" />
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Title">
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="AGM 2026 — date confirmed" />
            </Field>
            <Field label="Message">
              <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="input resize-none" placeholder="Dear members, …" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Audience">
                <Select value={audience} onChange={(e) => setAudience(e.target.value)} options={[
                  { value: 'all', label: 'All members' },
                  { value: 'role', label: 'By role' },
                ]} />
              </Field>
              {audience === 'role' && (
                <Field label="Role">
                  <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} options={[
                    { value: '', label: 'Select role…' },
                    ...roles.map((r) => ({ value: String(r.id), label: r.name })),
                  ]} />
                </Field>
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-[13px] text-green">
              <Icon name="group" size={16} /> Will reach <strong>{recipients}</strong> active member{recipients === 1 ? '' : 's'}
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Channels</span>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const on = channels.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition ${
                        on ? 'border-green bg-green-50 text-green' : 'border-line text-muted hover:bg-sand'
                      }`}
                    >
                      <Icon name={c.icon} size={16} />
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={saveDraft} loading={create.isPending && !send.isPending}>
                Save draft
              </Button>
              <Button type="submit" size="sm" icon="send" loading={create.isPending || send.isPending}>
                Send to members
              </Button>
            </div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="px-5 py-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">History</h3>
          </div>
          <QueryState isLoading={list.isLoading} isError={list.isError}>
            <div className="divide-y divide-line">
              {(list.data ?? []).map((a) => (
                <div key={a.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-[14px] font-semibold text-ink">{a.title}</div>
                    <div className="flex items-center gap-2">
                      <Badge tone={a.status === 'sent' ? 'green' : 'gold'} dot>
                        {a.status}
                      </Badge>
                      {a.status !== 'sent' && (
                        <button
                          onClick={() => sendExisting(a.id)}
                          className="text-xs font-semibold text-green hover:underline"
                          title="Send now"
                        >
                          Send
                        </button>
                      )}
                      <button
                        onClick={() => remove(a.id)}
                        className="text-muted-2 transition hover:text-danger"
                        title="Delete"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] text-muted">{a.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-2">
                    <span className="flex items-center gap-1">
                      <Icon name="group" size={14} /> reach {a.reach}
                    </span>
                    <span className="flex items-center gap-1">
                      {(a.channels ?? []).join(' · ')}
                    </span>
                    <span>{a.sent_at ? dateTime(a.sent_at) : '—'}</span>
                  </div>
                </div>
              ))}
              {(list.data ?? []).length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted">No announcements yet.</p>
              )}
            </div>
          </QueryState>
        </Card>
      </div>
    </div>
  )
}
