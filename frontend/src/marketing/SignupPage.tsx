import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PlatformMark } from '@/ui/PlatformMark'
import { Icon } from '@/ui/Icon'
import { Field } from '@/ui/Field'
import { Button } from '@/ui/Button'
import { LocationSelect, CoopTypeSelect } from '@/ui/StateLGASelect'
import { apiErrorMessage } from '@/lib/apiError'
import { usePublicBranding, usePublicSiteContent } from '@/api/public'
import { useAuth } from '@/auth/AuthContext'
import {
  useApplyForCooperative,
  useJoinAnother,
  useJoinLink,
  useRequestToJoin,
  useSocietySearch,
  type PublicSociety,
} from '@/api/signup'
import brandPhoto from '@/assets/site/gallery-meeting.webp'

/**
 * Signing a cooperative up, and asking to join a cooperative already on it.
 *
 * Laid out as the two-panel shell the sign-in page uses, so the three public
 * auth surfaces read as one product. The signup is split across two steps:
 * ten fields in a single column is what made it feel like paperwork, and the
 * split falls on a natural seam — the cooperative, then the person.
 *
 * A society is live the moment it signs up, on its free trial. The founder
 * chooses a password here and lands in the console signed in; verifying the
 * society (its KYC) is a later step the dashboard walks them through.
 */

type Mode = 'choose' | 'society' | 'member'

const APPLICATION_STEPS = ['Your cooperative', 'About you']

const REASSURANCES = [
  'Live in minutes — no setup call, no waiting for approval',
  'Free for your first month, with nothing to pay up front',
  'Money settles into your cooperative’s own bank account',
]

export function SignupPage() {
  // /join/<code> is a society's invite link: straight to the member form, with
  // the society already chosen.
  const { code } = useParams<{ code: string }>()
  const [mode, setMode] = useState<Mode>(code ? 'member' : 'choose')
  const { data: branding } = usePublicBranding()
  const { data: cms } = usePublicSiteContent()
  const productName = branding?.name || 'CooperativeOS'

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-paper lg:flex"
        style={{
          // Same green wash as the landing page's closing banner: a known-good
          // contrast ratio over any photograph, including a replacement.
          backgroundImage:
            `linear-gradient(rgba(11,79,58,.90), rgba(11,79,58,.95)), ` +
            `url(${brandPhoto})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Link to="/" className="flex items-center gap-3">
          <PlatformMark size={44} />
          <div>
            <div className="font-display text-lg font-semibold">{productName}</div>
            <div className="text-xs text-green-200">
              {cms?.footer.tagline || 'by Startup Ripple'}
            </div>
          </div>
        </Link>

        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            {cms?.hero.title ||
              'A digital operating layer for cooperatives everywhere.'}
          </h1>
          <ul className="mt-7 space-y-3.5">
            {REASSURANCES.map((point) => (
              <li key={point} className="flex items-start gap-3 text-green-100">
                <Icon name="check_circle" size={19} className="mt-0.5 shrink-0 text-gold" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-xs text-green-200">
          Data-protection compliant · signed PSP webhooks · 2FA for finance roles
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,158,43,.22), transparent 70%)' }}
        />
      </aside>

      {/* ── Form column ─────────────────────────────────────────── */}
      <main className="flex items-start justify-center bg-paper px-5 py-10 sm:py-14">
        <div className="w-full max-w-lg">
          {/* The brand panel is hidden on small screens, so the mark comes
              back here rather than leaving the page unbranded. */}
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <PlatformMark size={36} />
              <span className="font-display text-[15px] font-semibold text-ink">
                {productName}
              </span>
            </Link>
            <Link to="/login" className="text-sm font-medium text-green hover:underline">
              Sign in
            </Link>
          </div>

          {mode === 'choose' && <Chooser onPick={setMode} />}
          {mode === 'society' && <CooperativeApplication onBack={() => setMode('choose')} />}
          {mode === 'member' && <MemberJoin joinCode={code} onBack={() => setMode('choose')} />}

          <p className="mt-8 hidden border-t border-line pt-5 text-sm text-muted lg:block">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-green hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

// ── Choosing a path ─────────────────────────────────────────────────────────
function Chooser({ onPick }: { onPick: (m: Mode) => void }) {
  const options = [
    {
      mode: 'society' as const,
      icon: 'storefront',
      title: 'Bring your cooperative on board',
      body: 'You run a cooperative and want it on CooperativeOS. Set it up in two minutes and use it free for your first month.',
      cta: 'Start your free trial',
    },
    {
      mode: 'member' as const,
      icon: 'person_add',
      title: 'Join a cooperative as a member',
      body: 'Your cooperative already uses CooperativeOS and you’d like your own access. An officer reviews every request before an account is created.',
      cta: 'Request membership',
    },
  ]

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Get started</h1>
      <p className="mt-2 text-muted">Which of these sounds like you?</p>

      <div className="mt-8 space-y-4">
        {/* The hover lift is a translate rather than a heavier shadow. This
            theme defines exactly two shadows, and Tailwind's generic medium
            default is a tighter, greyer shape that clashes with the soft warm
            one used everywhere else. (Naming that class here, even in a
            comment, would make Tailwind emit a rule for it — the scanner reads
            raw file text, not parsed JSX.) */}
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            onClick={() => onPick(o.mode)}
            className="group flex w-full items-start gap-4 rounded-card border border-line bg-card p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-green"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green transition group-hover:bg-green group-hover:text-paper">
              <Icon name={o.icon} size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[17px] font-semibold text-ink">
                {o.title}
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-muted">
                {o.body}
              </span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-green">
                {o.cta}
                <Icon
                  name="arrow_forward"
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Shared pieces ───────────────────────────────────────────────────────────
function FormHeader({
  onBack,
  title,
  intro,
}: {
  onBack: () => void
  title: string
  intro: string
}) {
  return (
    <div className="mb-7">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
      >
        <Icon name="arrow_back" size={16} /> Back
      </button>
      <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-muted">{intro}</p>
    </div>
  )
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
              i <= current ? 'bg-green text-paper' : 'bg-sand-deep text-muted-2'
            }`}
          >
            {i < current ? <Icon name="check" size={15} /> : i + 1}
          </span>
          <span
            className={`text-sm font-medium ${
              i <= current ? 'text-ink' : 'text-muted-2'
            }`}
          >
            {s}
          </span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-line" />}
        </div>
      ))}
    </div>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
      <Icon name="error" size={18} className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function Done({
  title,
  body,
  next,
}: {
  title: string
  body: string
  next?: string[]
}) {
  return (
    <div className="rounded-card border border-line bg-card p-8 shadow-soft">
      <span className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green">
        <Icon name="check_circle" size={26} />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

      {next && next.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-sand/50 p-4">
          <div className="mb-3 text-[13px] font-semibold text-ink">
            What happens next
          </div>
          <ol className="space-y-2.5">
            {next.map((item, i) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-green-50 font-mono text-[11px] font-semibold text-green">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline"
      >
        <Icon name="arrow_back" size={16} /> Back to the site
      </Link>
    </div>
  )
}

// ── A cooperative signing up ────────────────────────────────────────────────
function CooperativeApplication({ onBack }: { onBack: () => void }) {
  const apply = useApplyForCooperative()
  const { login, setActiveCooperativeId } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    society_name: '', applicant_name: '', applicant_email: '', password: '',
    applicant_phone: '', country: '', state: '', lga: '', coop_type: '',
    estimated_members: '',
  })
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Pressing Enter in a field can submit the form implicitly, even though
    // Continue is a plain button. On an earlier step that would fire off a
    // half-filled signup, so advance instead of sending.
    if (step < APPLICATION_STEPS.length - 1) {
      if (form.society_name.trim()) setStep(step + 1)
      return
    }
    setError(null)
    let created: { cooperative_id: number }
    try {
      created = await apply.mutateAsync({
        ...form,
        estimated_members: Number(form.estimated_members) || 0,
      })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not set up your cooperative.'))
      return
    }
    // Signed in through the ordinary login, with the password just chosen —
    // signup itself hands out no token.
    try {
      await login(form.applicant_email, form.password)
      setActiveCooperativeId(created.cooperative_id)
      navigate('/console', { replace: true })
    } catch {
      // The society exists; only the automatic sign-in failed.
      navigate('/login', { replace: true })
    }
  }

  return (
    <div>
      <FormHeader
        onBack={onBack}
        title="Bring your cooperative on board"
        intro="Two short steps, and you’re in. Free for your first month."
      />

      <Stepper steps={APPLICATION_STEPS} current={step} />

      <form onSubmit={submit} className="rounded-card border border-line bg-card p-6 shadow-soft">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Cooperative name">
              <input
                required
                autoFocus
                value={form.society_name}
                className="input"
                onChange={(e) => set('society_name', e.target.value)}
                placeholder="Ìmọ̀lè Multipurpose Cooperative"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <CoopTypeSelect
                value={form.coop_type}
                onChange={(v) => set('coop_type', v)}
              />
              <Field label="Approximate members" hint="A rough number is fine.">
                <input
                  inputMode="numeric"
                  value={form.estimated_members}
                  className="input"
                  placeholder="320"
                  onChange={(e) => set('estimated_members', e.target.value)}
                />
              </Field>
            </div>

            <LocationSelect
              country={form.country}
              state={form.state}
              lga={form.lga}
              onCountry={(v) => set('country', v)}
              onState={(v) => set('state', v)}
              onLga={(v) => set('lga', v)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Your name">
              <input
                required
                autoFocus
                value={form.applicant_name}
                className="input"
                onChange={(e) => set('applicant_name', e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.applicant_email}
                  className="input"
                  placeholder="you@yourcoop.coop"
                  onChange={(e) => set('applicant_email', e.target.value)}
                />
              </Field>
              <Field label="Phone" hint="Optional.">
                <input
                  value={form.applicant_phone}
                  className="input"
                  placeholder="0803 000 0000"
                  onChange={(e) => set('applicant_phone', e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Choose a password"
              hint="At least 8 characters. Already on CooperativeOS? Use your existing password."
            >
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                className="input"
                onChange={(e) => set('password', e.target.value)}
              />
            </Field>

            {error && <ErrorNote message={error} />}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (step === 0 ? onBack() : setStep(step - 1))}
          >
            Back
          </Button>

          {step < APPLICATION_STEPS.length - 1 ? (
            <Button
              type="button"
              icon="arrow_forward"
              // Step-0 inputs unmount on the next step, so the browser cannot
              // enforce `required` on them at submit — gate it here instead.
              disabled={!form.society_name.trim()}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" loading={apply.isPending}>
              Create my cooperative
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

// ── A member joining ────────────────────────────────────────────────────────
function MemberJoin({ joinCode, onBack }: { joinCode?: string; onBack: () => void }) {
  const join = useRequestToJoin()
  // Already signed in (a member of another society, following an invite):
  // ask with that account. No details to retype and no second account.
  const { user } = useAuth()
  const signedIn = user && !user.is_platform_admin ? user : null
  const joinAnother = useJoinAnother()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<PublicSociety | null>(null)
  // The invite link's society stands until the visitor picks another.
  const [useInvite, setUseInvite] = useState(Boolean(joinCode))
  const invite = useJoinLink(useInvite ? joinCode : undefined)
  const invited = useInvite ? invite.data ?? null : null
  const society = picked ?? invited
  const setSociety = (s: PublicSociety | null) => {
    setUseInvite(false)
    setPicked(s)
  }
  const results = useSocietySearch(query)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '' })
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!society) return
    setError(null)
    try {
      if (signedIn) await joinAnother.mutateAsync({ cooperative: society.id, message: form.message })
      else await join.mutateAsync({ cooperative: society.id, ...form })
      setDone(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send your request.'))
    }
  }

  if (done && signedIn) {
    return (
      <Done
        title="Request sent"
        body={`An officer of ${society?.name ?? 'the cooperative'} will review your request.`}
        next={[
          'An officer checks your details against their member register.',
          'When they admit you, we email you — there is nothing new to set up.',
          'The cooperative then appears when you tap your cooperative’s name in the app, so you can switch with one tap.',
        ]}
      />
    )
  }

  if (done) {
    return (
      <Done
        title="Request sent"
        body="An officer of the cooperative will review your request."
        next={[
          'An officer checks your details against their member register.',
          'If they admit you, we email you a link to set your own password.',
          'You’ll never be sent a password itself — only a link to choose one.',
        ]}
      />
    )
  }

  return (
    <div>
      <FormHeader
        onBack={onBack}
        title={invited ? `Join ${invited.name}` : 'Join a cooperative'}
        intro={
          invited
            ? 'Tell them who you are — an officer will review your request.'
            : 'Find your cooperative, then tell them who you are.'
        }
      />

      {useInvite && invite.isError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-line bg-card px-3.5 py-3 text-sm text-ink-soft">
          <Icon name="link_off" size={18} className="mt-0.5 shrink-0 text-muted" />
          <span>
            This invite link isn’t active any more. Ask an officer for a new
            one, or search for your cooperative below.
          </span>
        </div>
      )}

      <form onSubmit={submit} className="rounded-card border border-line bg-card p-6 shadow-soft">
        <div className="space-y-4">
          <Field
            label="Your cooperative"
            hint={society ? undefined : 'Start typing its name — at least two letters.'}
            // The results list below is a list of buttons. Inside a <label>
            // iOS Safari forwards their taps to the search input instead of
            // firing onClick, so an iPhone user could search but never select.
            interactive
            htmlFor="coop-search"
          >
            {useInvite && invite.isLoading ? (
              <p className="rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-muted">
                Opening your invite…
              </p>
            ) : society ? (
              <div className="flex items-center gap-3 rounded-md border border-green bg-green-50 px-3.5 py-2.5">
                {invited?.logo ? (
                  <img src={invited.logo} alt="" className="size-8 shrink-0 rounded object-contain" />
                ) : (
                  <Icon name="check_circle" size={18} className="shrink-0 text-green" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{society.name}</div>
                  {(society.lga || society.state) && (
                    <div className="truncate text-xs text-muted">
                      {[society.lga, society.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSociety(null)}
                  className="shrink-0 text-sm font-medium text-green hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon
                    name="search"
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
                  />
                  <input
                    autoFocus
                    id="coop-search"
                    value={query}
                    className="input pl-10"
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name"
                  />
                </div>
                {query.trim().length >= 2 && (
                  <div className="mt-2 overflow-hidden rounded-md border border-line bg-card">
                    {results.isLoading && (
                      <p className="px-3.5 py-2.5 text-sm text-muted">Searching…</p>
                    )}
                    {results.data?.length === 0 && (
                      <p className="px-3.5 py-2.5 text-sm text-muted">
                        No <strong className="font-medium text-ink-soft">live</strong>{' '}
                        cooperative matches that name. It may not be on{' '}
                        {/* Deliberately three possibilities, not one. This used
                            to say "check the spelling", which is a confident
                            wrong answer for the common case: the cooperative
                            exists but has not gone live yet, so it is not
                            listed here and cannot admit anyone. */}
                        CooperativeOS yet, or may still be setting up — ask an
                        officer for the exact name it is registered under.
                      </p>
                    )}
                    {results.data?.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSociety(s)}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-sand"
                      >
                        <span className="truncate text-ink">{s.name}</span>
                        <span className="shrink-0 text-xs text-muted-2">
                          {[s.lga, s.state].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>

          {signedIn ? (
            <div className="flex items-center gap-3 rounded-md border border-line bg-sand/50 px-3.5 py-2.5 text-sm">
              <Icon name="account_circle" size={20} className="shrink-0 text-muted" />
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">Asking as {signedIn.full_name}</div>
                <div className="truncate text-xs text-muted">
                  {signedIn.email} · with the account you already have
                </div>
              </div>
            </div>
          ) : (<>
          <Field label="Your full name">
            <input
              required
              value={form.full_name}
              className="input"
              onChange={(e) => set('full_name', e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                className="input"
                placeholder="you@example.com"
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Phone" hint="Optional.">
              <input
                value={form.phone}
                className="input"
                placeholder="0803 000 0000"
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </div>
          </>)}

          <Field
            label="Anything the officers should know?"
            hint="Optional — your member number from the paper register, who introduced you."
          >
            <textarea
              rows={3}
              value={form.message}
              className="input"
              onChange={(e) => set('message', e.target.value)}
            />
          </Field>

          {error && <ErrorNote message={error} />}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={!society} loading={join.isPending || joinAnother.isPending}>
            {society ? 'Send request' : 'Choose your cooperative first'}
          </Button>
        </div>
      </form>
    </div>
  )
}
