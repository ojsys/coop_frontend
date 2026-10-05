import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Icon } from '@/ui/Icon'
import { naira } from '@/lib/format'

// A local stand-in for the Paystack hosted checkout, used only when no live key
// is configured (`payment_simulated`). It reproduces the real flow's shape — a
// checkout you must actively complete before anything posts — so the end-to-end
// experience is testable without credentials. Add a PAYSTACK_SECRET_KEY and this
// screen is replaced by the real Paystack checkout automatically.
export function MockCheckoutPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, activeMembership } = useAuth()

  const reference = params.get('reference') || ''
  const amount = params.get('amount') || '0'

  function pay() {
    // Completing the (test) checkout → the callback page verifies & posts.
    navigate(`/app/pay/callback?reference=${encodeURIComponent(reference)}`)
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card shadow-float">
        <div className="flex items-center justify-between bg-green px-5 py-3 text-paper">
          <span className="font-mono text-xs tracking-wide">paystack</span>
          <span className="rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-bold uppercase text-green">
            Test mode
          </span>
        </div>

        <div className="px-5 py-6">
          <div className="text-center">
            <div className="text-[13px] text-muted">{user?.email}</div>
            <div className="mt-1 text-[13px] text-muted">
              Pay {activeMembership?.cooperative_name}
            </div>
            <div className="mt-2 font-display text-4xl font-semibold text-ink tnum">
              {naira(amount)}
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-lg border border-gold-50 bg-gold-50 px-3 py-2.5 text-[12px] text-gold-deep">
            <Icon name="info" size={16} className="mt-0.5" />
            <span>
              Local <b>test mode</b> — no Paystack keys are configured, so this
              stands in for Paystack's real checkout. Card / bank / USSD details
              are never entered here; they're collected inside Paystack.
            </span>
          </div>

          <button
            onClick={pay}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-green px-4 py-3 font-semibold text-paper transition hover:bg-green-hover"
          >
            <Icon name="check_circle" size={18} />
            Complete test payment
          </button>
          <button
            onClick={() => navigate('/app/contribute')}
            className="mt-2 w-full rounded-md px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-sand"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
