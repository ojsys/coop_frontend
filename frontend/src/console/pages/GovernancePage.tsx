import { useState } from 'react'
import { useMeetings, useResolutions, useAttendances, useMembers } from '@/api/hooks'
import {
  useResolutionAction,
  useCreateMeeting,
  useCreateResolution,
  useMeetingsCrud,
  useResolutionsCrud,
  useAttendancesCrud,
} from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge, StatusPill } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { longDate } from '@/lib/format'
import type { Meeting, Resolution } from '@/api/types'

const EMPTY_RESULTS = { for: 0, against: 0, abstain: 0, for_weight: '0', against_weight: '0', passed: false }

export function GovernancePage() {
  const meetings = useMeetings()
  const resolutions = useResolutions()
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [detail, setDetail] = useState<Meeting | null>(null)
  const { remove } = useMeetingsCrud()

  const passed = (resolutions.data ?? []).filter((r) => r.outcome === 'passed').length
  const failed = (resolutions.data ?? []).filter((r) => r.outcome === 'failed').length

  return (
    <div>
      <PageHeader
        title="Governance"
        subtitle="Meetings, minutes, attendance, resolutions & tamper-evident voting"
        actions={
          <div className="flex gap-2">
            <Button size="sm" icon="event" variant="secondary" onClick={() => setMeetingOpen(true)}>New meeting</Button>
            <Button size="sm" icon="add" onClick={() => setResolutionOpen(true)}>New resolution</Button>
          </div>
        }
      />

      {/* Meetings */}
      <h3 className="mb-2 font-display text-[15px] font-semibold text-ink">Meetings</h3>
      <QueryState isLoading={meetings.isLoading} isError={meetings.isError}>
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {(meetings.data ?? []).length === 0 && (
            <Card><p className="py-4 text-center text-sm text-muted">No meetings scheduled yet.</p></Card>
          )}
          {(meetings.data ?? []).map((m) => (
            <Card key={m.id}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center rounded-lg bg-green-50 px-2.5 py-1.5 text-green">
                  <span className="font-display text-xl font-semibold leading-none">{new Date(m.scheduled_at).getDate()}</span>
                  <span className="text-[10px] uppercase">{new Date(m.scheduled_at).toLocaleDateString('en-NG', { month: 'short' })}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-[15px] font-semibold text-ink">{m.title}</h4>
                    <StatusPill status={m.status} />
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">{m.location || '—'} · {longDate(m.scheduled_at)}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-2">
                    <span className="flex items-center gap-1"><Icon name="groups" size={14} /> {m.attendance_count} attended</span>
                    {m.proxy_enabled && <span className="flex items-center gap-1"><Icon name="how_to_reg" size={14} /> proxy on</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Button size="sm" variant="secondary" icon="edit_note" className="flex-1" onClick={() => setDetail(m)}>Minutes & attendance</Button>
                <Button size="sm" variant="ghost" icon="delete" onClick={() => remove.mutate(m.id)} />
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      {/* Resolutions register */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold text-ink">Resolutions register</h3>
        <div className="flex gap-2 text-xs">
          <Badge tone="green">{passed} passed</Badge>
          <Badge tone="neutral">{failed} failed</Badge>
        </div>
      </div>
      <QueryState isLoading={resolutions.isLoading} isError={resolutions.isError}>
        <div className="space-y-3">
          {(resolutions.data ?? []).map((r) => <ResolutionCard key={r.id} r={r} meetings={meetings.data ?? []} />)}
          {(resolutions.data ?? []).length === 0 && (
            <Card><p className="py-6 text-center text-sm text-muted">No resolutions yet.</p></Card>
          )}
        </div>
      </QueryState>

      <NewMeetingModal open={meetingOpen} onClose={() => setMeetingOpen(false)} />
      <NewResolutionModal open={resolutionOpen} onClose={() => setResolutionOpen(false)} meetings={meetings.data ?? []} />
      {detail && <MeetingDetailModal meeting={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function ResolutionCard({ r, meetings }: { r: Resolution; meetings: Meeting[] }) {
  const action = useResolutionAction()
  const { remove } = useResolutionsCrud()
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const res = r.results ?? EMPTY_RESULTS
  const total = res.for + res.against + res.abstain
  const forPct = total ? Math.round((res.for / total) * 100) : 0

  async function run(a: 'open' | 'close') {
    try {
      await action.mutateAsync({ id: r.id, action: a })
      toast(a === 'open' ? 'Resolution opened for voting' : 'Voting closed')
    } catch (err) { toast(apiErrorMessage(err, 'Action failed'), 'error') }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-[15px] font-semibold text-ink">{r.title}</h4>
            <StatusPill status={r.status} />
            {r.outcome !== 'pending' && <Badge tone={r.outcome === 'passed' ? 'green' : 'neutral'}>{r.outcome}</Badge>}
          </div>
          {r.description && <p className="mt-1 text-[13px] text-muted">{r.description}</p>}
          <div className="mt-3 flex items-center gap-4 text-[13px]">
            <Tally label="For" value={res.for} tone="text-green-bright" />
            <Tally label="Against" value={res.against} tone="text-danger" />
            <Tally label="Abstain" value={res.abstain} tone="text-muted" />
          </div>
          {total > 0 && (
            <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-sand-deep">
              <div className="h-full rounded-full bg-green-bright" style={{ width: `${forPct}%` }} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {r.status === 'draft' && <Button size="sm" icon="lock_open" onClick={() => run('open')} loading={action.isPending}>Open vote</Button>}
          {r.status === 'open' && <Button size="sm" variant="secondary" icon="how_to_vote" onClick={() => run('close')} loading={action.isPending}>Close vote</Button>}
          <div className="flex gap-1">
            {r.status === 'draft' && (
              <button onClick={() => setEditOpen(true)} className="rounded-md p-1.5 text-muted-2 hover:bg-sand hover:text-ink" title="Edit"><Icon name="edit" size={16} /></button>
            )}
            <button onClick={() => remove.mutate(r.id)} className="rounded-md p-1.5 text-muted-2 hover:text-danger" title="Delete"><Icon name="delete" size={16} /></button>
          </div>
        </div>
      </div>
      {editOpen && <EditResolutionModal resolution={r} meetings={meetings} onClose={() => setEditOpen(false)} />}
    </Card>
  )
}

function Tally({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon name="circle" size={9} className={tone} fill />
      <span className="font-mono font-medium text-ink tnum">{value}</span>
      <span className="text-muted-2">{label}</span>
    </span>
  )
}

// ── Meeting detail: minutes + attendance ────────────────────────────────────
function MeetingDetailModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { update } = useMeetingsCrud()
  const { data: members = [] } = useMembers()
  const { data: attendances = [] } = useAttendances(meeting.id)
  const attCrud = useAttendancesCrud()
  const toast = useToast()
  const [minutes, setMinutes] = useState(meeting.minutes)
  const [status, setStatus] = useState(meeting.status)

  const presentIds = new Set(attendances.filter((a) => a.present).map((a) => a.membership))

  async function saveMinutes() {
    try { await update.mutateAsync({ id: meeting.id, minutes, status }); toast('Meeting updated') }
    catch (err) { toast(apiErrorMessage(err, 'Could not save'), 'error') }
  }

  async function toggleAttendance(membershipId: number) {
    const existing = attendances.find((a) => a.membership === membershipId)
    try {
      if (existing) await attCrud.remove.mutateAsync(existing.id)
      else await attCrud.create.mutateAsync({ meeting: meeting.id, membership: membershipId, present: true })
    } catch (err) { toast(apiErrorMessage(err, 'Could not update attendance'), 'error') }
  }

  return (
    <Modal open onClose={onClose} width={640} title={meeting.title} subtitle={longDate(meeting.scheduled_at)}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[
              { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In progress' }, { value: 'concluded', label: 'Concluded' },
            ]} />
          </Field>
        </div>
        <Field label="Minutes">
          <textarea rows={4} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="input resize-none" placeholder="Record what was discussed and decided…" />
        </Field>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveMinutes} loading={update.isPending}>Save minutes</Button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-soft">Attendance</span>
            <span className="text-xs text-muted-2">{presentIds.size} present</span>
          </div>
          <div className="max-h-56 space-y-1 overflow-auto">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2.5 rounded-md border border-line px-3 py-1.5 text-[13px]">
                <input type="checkbox" checked={presentIds.has(m.id)} onChange={() => toggleAttendance(m.id)} className="accent-green" />
                <span className="flex-1 text-ink-soft">{m.full_name}</span>
                <span className="font-mono text-xs text-muted-2">{m.member_no}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Create / edit meetings ──────────────────────────────────────────────────
function MeetingForm({ meeting, onClose }: { meeting?: Meeting; onClose: () => void }) {
  const create = useCreateMeeting()
  const { update } = useMeetingsCrud()
  const toast = useToast()
  const isEdit = !!meeting
  const [form, setForm] = useState({
    title: meeting?.title ?? '',
    location: meeting?.location ?? '',
    scheduled_at: meeting ? meeting.scheduled_at.slice(0, 16) : '',
    proxy_enabled: meeting?.proxy_enabled ?? true,
    agenda: meeting?.agenda ?? '',
  })
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: form.title, location: form.location, agenda: form.agenda,
      scheduled_at: new Date(form.scheduled_at).toISOString(), proxy_enabled: form.proxy_enabled,
    }
    try {
      if (isEdit) await update.mutateAsync({ id: meeting!.id, ...payload })
      else await create.mutateAsync(payload)
      toast(isEdit ? 'Meeting updated' : 'Meeting scheduled')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not save meeting'), 'error') }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Title"><input required value={form.title} onChange={(e) => set('title', e.target.value)} className="input" placeholder="AGM 2026" /></Field>
      <Field label="Location"><input value={form.location} onChange={(e) => set('location', e.target.value)} className="input" placeholder="Civic Centre, Lagos & online" /></Field>
      <Field label="Agenda"><textarea rows={2} value={form.agenda} onChange={(e) => set('agenda', e.target.value)} className="input resize-none" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date & time"><input required type="datetime-local" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} className="input" /></Field>
        <Field label="Proxy attendance">
          <Select value={form.proxy_enabled ? 'yes' : 'no'} onChange={(e) => set('proxy_enabled', e.target.value === 'yes')} options={[{ value: 'yes', label: 'Enabled' }, { value: 'no', label: 'Disabled' }]} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" loading={create.isPending || update.isPending}>{isEdit ? 'Save' : 'Schedule'}</Button>
      </div>
    </form>
  )
}

function NewMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <Modal open onClose={onClose} title="New meeting" subtitle="Schedule an AGM or committee meeting"><MeetingForm onClose={onClose} /></Modal>
}

// ── Create / edit resolutions ───────────────────────────────────────────────
function ResolutionForm({ resolution, meetings, onClose }: { resolution?: Resolution; meetings: Meeting[]; onClose: () => void }) {
  const create = useCreateResolution()
  const { update } = useResolutionsCrud()
  const toast = useToast()
  const isEdit = !!resolution
  const [form, setForm] = useState({
    title: resolution?.title ?? '',
    description: resolution?.description ?? '',
    meeting: resolution?.meeting ? String(resolution.meeting) : '',
    voting_mode: resolution?.voting_mode ?? 'one_member',
  })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { title: form.title, description: form.description, meeting: form.meeting ? Number(form.meeting) : null, voting_mode: form.voting_mode as 'one_member' | 'weighted' }
    try {
      if (isEdit) await update.mutateAsync({ id: resolution!.id, ...payload })
      else await create.mutateAsync(payload)
      toast(isEdit ? 'Resolution updated' : 'Resolution created as draft')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not save resolution'), 'error') }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Title"><input required value={form.title} onChange={(e) => set('title', e.target.value)} className="input" placeholder="Increase monthly dues to ₦6,000" /></Field>
      <Field label="Description"><textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="input resize-none" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meeting" hint="Optional">
          <Select value={form.meeting} onChange={(e) => set('meeting', e.target.value)} options={[{ value: '', label: 'No meeting' }, ...meetings.map((m) => ({ value: String(m.id), label: m.title }))]} />
        </Field>
        <Field label="Voting mode">
          <Select value={form.voting_mode} onChange={(e) => set('voting_mode', e.target.value)} options={[{ value: 'one_member', label: 'One member, one vote' }, { value: 'weighted', label: 'Weighted by share' }]} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" loading={create.isPending || update.isPending}>{isEdit ? 'Save' : 'Create draft'}</Button>
      </div>
    </form>
  )
}

function NewResolutionModal({ open, onClose, meetings }: { open: boolean; onClose: () => void; meetings: Meeting[] }) {
  if (!open) return null
  return <Modal open onClose={onClose} title="New resolution" subtitle="Draft a motion members will vote on"><ResolutionForm meetings={meetings} onClose={onClose} /></Modal>
}

function EditResolutionModal({ resolution, meetings, onClose }: { resolution: Resolution; meetings: Meeting[]; onClose: () => void }) {
  return <Modal open onClose={onClose} title={`Edit ${resolution.title}`} subtitle="Draft resolution"><ResolutionForm resolution={resolution} meetings={meetings} onClose={onClose} /></Modal>
}
