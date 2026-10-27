import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '@/ui/Logo'
import { Icon } from '@/ui/Icon'
import { money } from '@/lib/format'
import { useAuth } from '@/auth/AuthContext'
import { landingSurface } from '@/api/auth'
import {
  useLegalIndex,
  usePublicBranding,
  usePlanCatalogue,
  usePublicPlans,
  usePublicSiteContent,
  type PublicPlan,
} from '@/api/public'

// Default photography, bundled rather than uploaded. Each one is overridden
// the moment an admin uploads their own on the matching CMS screen, so these
// are a starting point, not a fixture. Provenance and the licensing caveat
// for photographs of identifiable people: src/assets/site/CREDITS.md.
import heroMembers from '@/assets/site/hero-members.webp'
import showcaseContributions from '@/assets/site/showcase-contributions.webp'
import showcaseLoans from '@/assets/site/showcase-loans.webp'
import showcaseAudit from '@/assets/site/showcase-audit.webp'
import galleryMarket from '@/assets/site/gallery-market.webp'
import galleryOfficers from '@/assets/site/gallery-officers.webp'
import galleryMeeting from '@/assets/site/gallery-meeting.webp'
import ctaCommunity from '@/assets/site/cta-community.webp'

/**
 * The public face of the product.
 *
 * Every word and photograph on this page is owned by the CMS (Django admin →
 * Site content), not by this file: changing the headline must not require a
 * developer, a build and a deploy.
 *
 * The constants below are a *fallback only* — used while the content request
 * is in flight, and if it fails outright. A marketing page that says nothing
 * because an API call failed is worse than one showing slightly stale wording.
 *
 * The two diagrams are drawn here rather than uploaded. They are structural
 * explanations of how the product works, not decoration, so they belong in
 * the code where they stay correct — and being vector, they stay sharp and
 * theme-aware at any size.
 *
 * Claims are drawn from the PRD rather than invented, including its explicit
 * non-goals: CooperativeOS is deliberately not a lender, a deposit-taking
 * institution, or an accounting-suite replacement.
 */
const FALLBACK = {
  heroEyebrow: 'Built for cooperatives and credit unions of 50–5,000 members',
  heroTitle: 'A digital operating layer for cooperatives everywhere.',
  heroSubtitle:
    'Membership, contributions, loans, governance and audit-ready reporting — in one place, on an append-only double-entry ledger your auditor can actually follow.',
  primaryCta: 'Get started',
  secondaryCta: 'Sign in to your cooperative',
  principleEyebrow: 'Our core principle',
  principleTitle: 'Every naira, traceable.',
  principleBody:
    'Contributions settle through licensed payment providers straight into your cooperative’s own bank account. Every movement is recorded in an append-only double-entry ledger — nothing is edited or deleted, corrections are posted as reversals, and your auditor can follow any figure back to the entry that produced it.',
  featuresTitle: 'Everything a cooperative runs on',
  showcaseTitle: 'A closer look at the day-to-day',
  stepsTitle: 'How it works',
  pricingTitle: 'Pricing by member band',
  pricingIntro:
    'One subscription per cooperative, set by how many active members you have — never a cut of your members’ money. Pay annually and get two months free.',
  pricingFallback:
    'Pricing depends on your cooperative’s size and how much history needs migrating.',
  ctaTitle: 'Ready to bring your cooperative on board?',
  ctaBody:
    'Set your cooperative up in two minutes and use it free for your first month. Want help moving your records across? We’ll do that with you.',
  ctaButton: 'Start your free trial',
  footerTagline: 'by Startup Ripple',
  footerDisclaimer:
    'CooperativeOS records and reports on cooperative finances. It is not a bank, a lender, or a deposit-taking institution, and it does not hold member funds.',
}

const HERO_ALT = 'Four women gathered around a laptop in an office, smiling'

/** Used in order, cycling if an admin adds more deep-dives than we ship. */
const SHOWCASE_DEFAULTS = [
  { src: showcaseContributions,
    alt: 'Women in bright wrappers and headwraps writing in their passbooks at a society meeting' },
  { src: showcaseLoans,
    alt: 'A farmer laughing beside sacks of his harvest, baskets of tomatoes behind him' },
  { src: showcaseAudit,
    alt: 'A man presenting financial charts on a screen to colleagues' },
]

// No captions on purpose. These are stock photographs, and a caption naming a
// cooperative would imply the people in them are members or customers.
const GALLERY_DEFAULTS = [
  { image: galleryMarket, caption: '',
    alt_text: 'A trader in a headwrap at her stall, baskets of tomatoes behind her' },
  { image: galleryOfficers, caption: '',
    alt_text: 'Four colleagues talking together in an office' },
  { image: galleryMeeting, caption: '',
    alt_text: 'Women in a meeting around a table, one standing to speak' },
]

const PRINCIPLE_POINTS = [
  'Funds settle to your cooperative’s account, never ours',
  'Every figure traces to an immutable double-entry ledger',
  'Corrections are reversals — nothing is ever quietly edited',
  'Each cooperative is an isolated tenant',
]

/**
 * Where the money actually goes.
 *
 * This is the single most misunderstood thing about the product — people
 * assume a platform that handles contributions must be holding them. The
 * diagram exists to make the answer unmissable: the money path never touches
 * us, and our line into it is one-way and dashed.
 */
function MoneyFlowDiagram() {
  const box = 'rgba(255,255,255,.10)'
  const stroke = 'rgba(255,255,255,.28)'
  return (
    <svg
      viewBox="0 0 660 250"
      className="h-auto w-full"
      role="img"
      aria-label="A member pays through a licensed payment provider, which settles directly into the cooperative's own bank account. CooperativeOS records the movement; collections never pass through it."
    >
      {[
        { x: 8, label: 'Member', sub: 'pays dues', icon: '👤' },
        { x: 236, label: 'Licensed PSP', sub: 'regulated rails' },
        { x: 464, label: 'Your cooperative', sub: 'own bank account' },
      ].map((n) => (
        <g key={n.label}>
          <rect
            x={n.x} y="28" width="188" height="78" rx="14"
            fill={box} stroke={stroke}
          />
          <text
            x={n.x + 94} y="62" textAnchor="middle"
            fill="#fffdf9" fontSize="17" fontWeight="600"
          >
            {n.label}
          </text>
          <text
            x={n.x + 94} y="84" textAnchor="middle"
            fill="rgba(255,255,255,.65)" fontSize="13"
          >
            {n.sub}
          </text>
        </g>
      ))}

      {/* Money path — solid, straight through, never via us. */}
      {[204, 432].map((x) => (
        <g key={x}>
          <line
            x1={x} y1="67" x2={x + 26} y2="67"
            stroke="#d99e2b" strokeWidth="2.5"
          />
          <polygon
            points={`${x + 32},67 ${x + 22},62 ${x + 22},72`}
            fill="#d99e2b"
          />
        </g>
      ))}

      {/* Us: off the money path, connected only by a one-way dashed line. */}
      <rect
        x="236" y="170" width="188" height="62" rx="14"
        fill="none" stroke={stroke} strokeDasharray="5 4"
      />
      <text
        x="330" y="197" textAnchor="middle"
        fill="#fffdf9" fontSize="15" fontWeight="600"
      >
        CooperativeOS
      </text>
      <text
        x="330" y="217" textAnchor="middle"
        fill="rgba(255,255,255,.65)" fontSize="12.5"
      >
        records &amp; reconciles
      </text>
      <line
        x1="330" y1="168" x2="330" y2="112"
        stroke={stroke} strokeWidth="1.5" strokeDasharray="5 4"
      />
      <text
        x="344" y="142" fill="rgba(255,255,255,.55)" fontSize="11.5"
      >
        reads only
      </text>
    </svg>
  )
}

/** The onboarding path, as a connected row of stages. */
function StepsDiagram({
  steps,
}: {
  steps: { number: string; icon: string; title: string }[]
}) {
  return (
    <div className="relative mt-12">
      {/* The connector sits behind the markers and only on wide screens,
          where the steps are actually in a row. */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-7 hidden h-px bg-line-deep md:block"
      />
      <ol className="relative grid gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-line bg-card text-green shadow-soft">
              <Icon name={s.icon} size={24} />
            </span>
            <span className="mt-3 font-mono text-xs font-semibold text-gold-deep">
              {s.number}
            </span>
            <span className="mt-1 font-display text-[15px] font-semibold text-ink">
              {s.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function LandingPage() {
  // Rendered for signed-in visitors too, so the calls to action can point at
  // the app instead of asking someone with an account to sign in again.
  const { user } = useAuth()
  const { data: branding } = usePublicBranding()
  const { data: cms } = usePublicSiteContent()
  // Policy pages an admin has published, for the footer. Absent is normal.
  const { data: legalDocs } = useLegalIndex()
  const plans = usePublicPlans()
  const { data: catalogue } = usePlanCatalogue()
  // Annual first, as the audit recommends: it is the standard offer, and
  // monthly stays available at a higher effective cost.
  const [cycle, setCycle] = useState<'annual' | 'monthly'>('annual')

  const productName = branding?.name || 'CooperativeOS'
  const supportEmail = branding?.support_email || ''

  const hero = cms?.hero
  const principle = cms?.principle
  const features = cms?.features ?? []
  const showcase = cms?.showcase ?? []
  const steps = cms?.steps ?? []
  const gallery = cms?.gallery ?? []
  const badges = cms?.trust_badges ?? []

  // Fall back to the bundled strip only when no gallery rows exist at all.
  // The payload carries visible rows only, so without this flag an admin who
  // hid every photo would get our stock ones back and no way to clear them.
  const galleryItems = gallery.length > 0
    ? gallery
    : (cms?.gallery_has_custom ? [] : GALLERY_DEFAULTS)
  const apps = cms?.apps
  const cta = cms?.cta

  // Hidden until there is something to link to or say about the apps.
  const showApps = Boolean(
    apps && (apps.android_url || apps.ios_url || apps.screenshot || apps.note),
  )

  useEffect(() => {
    const title = cms?.meta.title || productName
    if (title) document.title = title

    const description = cms?.meta.description
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      )
      if (!tag) {
        tag = document.createElement('meta')
        tag.name = 'description'
        document.head.appendChild(tag)
      }
      tag.content = description
    }
  }, [cms, productName])

  const mark = branding?.logo ? (
    <img src={branding.logo} alt="" className="size-full object-contain" />
  ) : (
    <LogoMark size={26} />
  )

  return (
    <div className="min-h-screen bg-paper text-ink-soft">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-gold">
              {mark}
            </div>
            <span className="font-display text-[15px] font-semibold text-ink">
              {productName}
            </span>
          </div>

          <nav className="ml-auto hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-muted transition hover:text-ink">What it does</a>
            <a href="#how" className="text-muted transition hover:text-ink">How it works</a>
            {showApps && (
              <a href="#apps" className="text-muted transition hover:text-ink">Mobile app</a>
            )}
            <a href="#pricing" className="text-muted transition hover:text-ink">Pricing</a>
          </nav>

          {/* Signed in, the page is still browsable — so the header offers the
              way back into the app rather than asking you to sign in again. */}
          <div className="ml-auto flex items-center gap-2 md:ml-6">
            {user ? (
              <Link
                to={`/${landingSurface(user)}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-green px-4 py-2 text-sm font-semibold text-paper transition hover:bg-green-hover"
              >
                Go to my dashboard
                <Icon name="arrow_forward" size={17} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-md px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand sm:block"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-paper transition hover:bg-green-hover"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,158,43,.18), transparent 70%)' }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_.95fr]">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-green-bright" />
              {hero?.eyebrow || FALLBACK.heroEyebrow}
            </span>

            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] text-ink md:text-6xl">
              {hero?.title || FALLBACK.heroTitle}
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              {hero?.subtitle || FALLBACK.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-green px-5 py-3 text-sm font-semibold text-paper transition hover:bg-green-hover"
              >
                {hero?.primary_cta || FALLBACK.primaryCta}
                <Icon name="arrow_forward" size={18} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold text-ink-soft transition hover:bg-sand"
              >
                {hero?.secondary_cta || FALLBACK.secondaryCta}
              </Link>
            </div>

            <p className="mt-5 text-[13px] text-muted-2">
              Free for your first month · No card required · Your books stay yours
            </p>
          </div>

          <img
            src={hero?.image || heroMembers}
            alt={hero?.image_alt || HERO_ALT}
            className="aspect-[4/3] w-full rounded-[20px] border border-line object-cover shadow-soft"
          />
        </div>
      </section>

      {/* ── Every naira, traceable ───────────────────────────────── */}
      <section className="bg-green text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:py-20 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-gold">
              {principle?.eyebrow || FALLBACK.principleEyebrow}
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">
              {principle?.title || FALLBACK.principleTitle}
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-green-100">
              {principle?.body || FALLBACK.principleBody}
            </p>
            <ul className="mt-6 space-y-3">
              {PRINCIPLE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-green-100">
                  <Icon name="check_circle" size={18} className="mt-0.5 text-gold" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="self-center rounded-[20px] border border-white/10 bg-white/[.04] p-5">
            <MoneyFlowDiagram />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      {features.length > 0 && (
        <section id="features" className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold text-ink">
            {cms?.features_title || FALLBACK.featuresTitle}
          </h2>
          {cms?.features_intro && (
            <p className="mt-2 max-w-xl text-muted">{cms.features_intro}</p>
          )}

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-[15px] border border-line bg-card p-5 transition hover:border-line-deep"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-green-50 text-green">
                  <Icon name={f.icon} size={21} />
                </span>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-ink">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Feature deep-dives ───────────────────────────────────── */}
      {showcase.length > 0 && (
        <section className="border-y border-line bg-sand/50">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="font-display text-3xl font-semibold text-ink">
              {cms?.showcase_title || FALLBACK.showcaseTitle}
            </h2>
            {cms?.showcase_intro && (
              <p className="mt-2 max-w-xl text-muted">{cms.showcase_intro}</p>
            )}

            <div className="mt-14 space-y-16">
              {showcase.map((s, i) => (
                <div
                  key={s.title}
                  className="grid items-center gap-10 lg:grid-cols-2"
                >
                  {/* Alternate sides. The image is ordered second on small
                      screens regardless, so the text always leads. */}
                  <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                    <h3 className="font-display text-2xl font-semibold text-ink">
                      {s.title}
                    </h3>
                    <p className="mt-3 leading-relaxed text-ink-soft">{s.body}</p>
                    {s.bullets.length > 0 && (
                      <ul className="mt-5 space-y-2.5">
                        {s.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2.5 text-sm text-muted">
                            <Icon name="check_circle" size={17} className="mt-0.5 text-green" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <img
                    src={s.image || SHOWCASE_DEFAULTS[i % SHOWCASE_DEFAULTS.length].src}
                    alt={s.image_alt || SHOWCASE_DEFAULTS[i % SHOWCASE_DEFAULTS.length].alt}
                    loading="lazy"
                    className={`aspect-[4/3] w-full rounded-[20px] border border-line object-cover shadow-soft ${
                      i % 2 === 1 ? 'lg:order-1' : ''
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────────── */}
      {steps.length > 0 && (
        <section id="how" className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold text-ink">
            {cms?.steps_title || FALLBACK.stepsTitle}
          </h2>
          {cms?.steps_intro && (
            <p className="mt-2 max-w-xl text-muted">{cms.steps_intro}</p>
          )}

          <StepsDiagram steps={steps} />

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="rounded-[15px] border border-line bg-card p-5">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── People strip ─────────────────────────────────────────── */}
      {galleryItems.length > 0 && (
        <section className="border-y border-line bg-card">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-3xl font-semibold text-ink">
              {cms?.gallery_title}
            </h2>
            {cms?.gallery_intro && (
              <p className="mt-2 max-w-xl text-muted">{cms.gallery_intro}</p>
            )}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((g, i) => (
                <figure key={g.image ?? i} className="overflow-hidden rounded-[15px] border border-line">
                  {g.image && (
                    <img
                      src={g.image}
                      alt={g.alt_text}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  )}
                  {g.caption && (
                    <figcaption className="bg-sand/60 px-4 py-2.5 text-[13px] text-muted">
                      {g.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Mobile apps ──────────────────────────────────────────── */}
      {showApps && apps && (
        <section id="apps" className="mx-auto max-w-6xl px-5 py-20">
          {/* One column until a screenshot exists. An empty placeholder panel
              beside the text reads as unfinished, and this slot wants your own
              app screenshot — no stock photograph can stand in for it. */}
          <div
            className={`grid items-center gap-12 ${
              apps.screenshot ? 'lg:grid-cols-[1fr_.8fr]' : ''
            }`}
          >
            <div>
              <h2 className="font-display text-3xl font-semibold text-ink">
                {apps.title}
              </h2>
              <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
                {apps.body}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {apps.android_url && (
                  <a
                    href={apps.android_url}
                    className="inline-flex items-center gap-2.5 rounded-md bg-green px-5 py-3 text-sm font-semibold text-paper transition hover:bg-green-hover"
                  >
                    <Icon name="android" size={20} />
                    Download for Android
                  </a>
                )}
                {apps.ios_url && (
                  <a
                    href={apps.ios_url}
                    className="inline-flex items-center gap-2.5 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold text-ink-soft transition hover:bg-sand"
                  >
                    <Icon name="phone_iphone" size={20} />
                    Download for iOS
                  </a>
                )}
              </div>

              {apps.note && (
                <p className="mt-4 text-[13px] text-muted-2">{apps.note}</p>
              )}
            </div>

            {apps.screenshot && (
              <div className="flex justify-center">
                <img
                  src={apps.screenshot}
                  alt={apps.screenshot_alt}
                  loading="lazy"
                  className="max-h-[520px] w-auto rounded-[28px] border border-line shadow-soft"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Pricing (live from the Plan table) ───────────────────── */}
      <section id="pricing" className="border-y border-line bg-sand/50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold text-ink">
            {cms?.pricing.title || FALLBACK.pricingTitle}
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            {cms?.pricing.intro || FALLBACK.pricingIntro}
          </p>

          {plans.isLoading && (
            <p className="mt-10 text-sm text-muted">Loading plans…</p>
          )}

          {(plans.isError || (plans.data && plans.data.length === 0)) && (
            <div className="mt-10 rounded-[15px] border border-line bg-card p-6">
              <p className="text-sm text-ink-soft">
                {cms?.pricing.fallback || FALLBACK.pricingFallback}{' '}
                {supportEmail && (
                  <>
                    <a href={`mailto:${supportEmail}`} className="font-medium text-green hover:underline">
                      Talk to us
                    </a>{' '}
                    and we’ll put a number to it.
                  </>
                )}
              </p>
            </div>
          )}

          {plans.data && plans.data.length > 0 && (
            <>
              <div
                role="tablist"
                aria-label="Billing cycle"
                className="mt-8 inline-flex rounded-full border border-line bg-card p-1"
              >
                {(['annual', 'monthly'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={cycle === c}
                    onClick={() => setCycle(c)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      cycle === c ? 'bg-green text-paper' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {c === 'annual' ? 'Annual · 2 months free' : 'Monthly'}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {plans.data.map((p, i) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    previous={i > 0 ? plans.data[i - 1] : undefined}
                    cycle={cycle}
                    supportEmail={supportEmail}
                  />
                ))}
              </div>

              {/* The full system of record is in every plan — the promise is
                  never sold in tiers. Listed once rather than ticked on every
                  card, which would bury what actually differs. */}
              {catalogue && catalogue.core.length > 0 && (
                <div className="mt-6 rounded-[15px] border border-line bg-card p-6">
                  <div className="font-display text-[15px] font-semibold text-ink">Every plan includes</div>
                  <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm text-ink-soft sm:grid-cols-2 lg:grid-cols-3">
                    {catalogue.core.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Icon name="check" size={16} className="mt-0.5 shrink-0 text-green" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted-2">
                Your plan follows your active member count. Prices are per
                cooperative, in naira.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Closing call to action ───────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div
          className="relative overflow-hidden rounded-[24px] bg-green px-6 py-14 text-center text-paper sm:px-12"
          style={{
            // The green wash keeps the headline readable over any photograph,
            // including one an admin uploads without checking contrast.
            backgroundImage:
              `linear-gradient(rgba(11,79,58,.86), rgba(11,79,58,.86)), ` +
              `url(${cta?.image || ctaCommunity})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight md:text-4xl">
            {cta?.title || FALLBACK.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-green-100">
            {cta?.body || FALLBACK.ctaBody}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-95"
            >
              {cta?.button || FALLBACK.ctaButton}
              <Icon name="arrow_forward" size={18} />
            </Link>
            {supportEmail && (
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-2 rounded-md border border-white/25 px-6 py-3 text-sm font-semibold text-paper transition hover:bg-white/10"
              >
                Talk to us first
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <section className="border-t border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-8 text-[13px] text-muted">
            {badges.map((b) => (
              <span key={b.text} className="inline-flex items-center gap-2">
                <Icon name={b.icon} size={16} className="text-green" />
                {b.text}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-green text-green-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-gold">
              {mark}
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-semibold text-paper">
                {productName}
              </div>
              <div className="text-[11px] text-green-200">
                {cms?.footer.tagline || FALLBACK.footerTagline}
              </div>
            </div>
          </div>

          <div className="text-sm md:ml-auto">
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="transition hover:text-paper">
                {supportEmail}
              </a>
            )}
            {branding?.support_phone && (
              <span className="ml-4">{branding.support_phone}</span>
            )}
          </div>

          <Link
            to={user ? `/${landingSurface(user)}` : '/login'}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-paper transition hover:bg-white/10"
          >
            {user ? 'Go to my dashboard' : 'Sign in'}
          </Link>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-[11px] text-green-200 sm:flex-row sm:items-center">
            <span>{cms?.footer.disclaimer || FALLBACK.footerDisclaimer}</span>
            {/* Reachable from the site, not only by typing the URL: the app
                stores have to find it, and members are entitled to.
                Privacy is always listed because it always resolves — to the
                admin's document when one is published, otherwise to the notice
                built into the app. Anything else appears once published. */}
            <span className="flex flex-wrap gap-x-4 gap-y-1 sm:ml-auto sm:shrink-0">
              <Link to="/privacy" className="transition hover:text-paper">
                Privacy notice
              </Link>
              {(legalDocs ?? [])
                .filter((d) => d.slug !== 'privacy')
                .map((d) => (
                  <Link
                    key={d.slug}
                    to={d.slug === 'terms' ? '/terms' : `/legal/${d.slug}`}
                    className="transition hover:text-paper"
                  >
                    {d.title}
                  </Link>
                ))}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}


/**
 * One plan, quoted for the chosen billing cycle.
 *
 * Every number comes from the plan record — the band, both prices and whether
 * the monthly figure is a starting price — so an agent's price card, this page
 * and the invoice cannot disagree. A plan without an annual list price
 * (Institutional) is quoted per society rather than shown a guessed figure.
 */
function PlanCard({
  plan: p,
  previous,
  cycle,
  supportEmail,
}: {
  plan: PublicPlan
  /** The plan one band down, so this card can say what it adds. */
  previous?: PublicPlan
  cycle: 'annual' | 'monthly'
  supportEmail: string
}) {
  const had = new Set(previous?.features.map((f) => f.key) ?? [])
  const added = p.features.filter((f) => !had.has(f.key))
  const monthly = Number(p.price_monthly)
  const annual = p.price_annual == null ? null : Number(p.price_annual)
  const quoted = annual == null
  const showAnnual = cycle === 'annual' && !quoted
  const saving = annual == null ? 0 : monthly * 12 - annual
  // What a member's share comes to at the top of the band — the per-member
  // value story the audit asks for. Only meaningful when the band has a top.
  const perMonth = showAnnual && annual != null ? annual / 12 : monthly
  const perMember = p.max_members ? perMonth / p.max_members : null

  return (
    <div className="flex flex-col rounded-[15px] border border-line bg-card p-6">
      <div className="font-display text-[17px] font-semibold text-ink">{p.name}</div>
      <div className="text-[13px] font-medium text-green">{p.band_label}</div>

      {showAnnual ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-display text-[28px] font-semibold leading-tight text-green tnum lg:text-2xl">
              {money(annual, p.currency)}
            </span>
            <span className="text-sm text-muted">/year</span>
          </div>
          <div className="mt-1 text-xs text-muted-2">
            {saving > 0 && <>Save {money(saving, p.currency)} · </>}
            or {money(monthly, p.currency)} monthly
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
            {p.price_is_from && <span className="text-sm text-muted">From</span>}
            <span className="font-display text-[28px] font-semibold leading-tight text-green tnum lg:text-2xl">
              {money(monthly, p.currency)}
            </span>
            <span className="text-sm text-muted">/month</span>
          </div>
          <div className="mt-1 text-xs text-muted-2">
            {quoted
              ? 'Annual price quoted for your society'
              : <>or {money(annual, p.currency)} a year — 2 months free</>}
          </div>
        </>
      )}

      {perMember != null && (
        <div className="mt-3 text-xs text-muted">
          About {money(Math.round(perMember * 100) / 100, p.currency)} per member a month at{' '}
          {p.max_members.toLocaleString()} members
        </div>
      )}

      {p.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{p.description}</p>
      )}

      <div className="mt-4 border-t border-line pt-4 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-2">
          {previous ? `Everything in ${previous.name}, plus` : 'The full system of record'}
        </div>
        {added.length > 0 || p.extras.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            {added.map((f) => (
              <li key={f.key} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-green" />
                {f.label}
              </li>
            ))}
            {p.extras.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-green" />
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">
            {previous ? 'A larger member band.' : 'Everything listed below.'}
          </p>
        )}
      </div>

      {/* Pushes the button to the card's foot so a row of cards lines up. */}
      <div className="flex-1" />
      {quoted && supportEmail ? (
        <a
          href={`mailto:${supportEmail}?subject=${encodeURIComponent(`${p.name} plan quote`)}`}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-sand"
        >
          Talk to us
        </a>
      ) : (
        <Link
          to="/signup"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-sand"
        >
          Get started
        </Link>
      )}
    </div>
  )
}
