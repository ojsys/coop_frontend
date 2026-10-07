import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVerifyPayment, useVerifyLoanRepayment } from '@/api/mutations'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'
import { Button } from '@/ui/Button'
import { naira } from '@/lib/format'

type Phase = 'verifying' | 'success' | 'failed'

// Paystack redirects here after checkout with ?reference= (and ?trxref=). We
// verify the charge server-side, which posts it to the ledger, then show the
// result. The webhook is a backup — this makes success instant for the member.
// A loan repayment redirect carries ?kind=loan&loan=<id>, verified differently.
export function PayCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const verify = useVerifyPayment()
  const verifyLoan = useVerifyLoanRepayment()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [amount, setAmount] = useState<string>('')
  const ran = useRef(false)

  const reference = params.get('reference') || params.get('trxref') || ''
  const isLoan = params.get('kind') === 'loan'
  const loanId = Number(params.get('loan'))

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!reference) {
      setPhase('failed')
      return
    }
    if (isLoan && loanId) {
      verifyLoan
        .mutateAsync({ loanId, reference })
        .then((loan) => {
          // The server answers 400 when Paystack has not been paid; this is
          // a second guard so arriving here can never read as success alone.
          if (loan.payment_status && loan.payment_status !== 'confirmed') {
            setPhase('failed')
            return
          }
          setAmount(loan.repaid_amount ?? '')
          setPhase('success')
        })
        .catch(() => setPhase('failed'))
      return
    }
    verify
      .mutateAsync(reference)
      .then((r) => {
        if (r.status === 'confirmed') {
          setAmount(r.amount)
          setPhase('success')
        } else {
          setPhase('failed')
        }
      })
      .catch(() => setPhase('failed'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      {phase === 'verifying' && (
        <>
          <Spinner className="size-8" />
          <h1 className="mt-5 font-display text-xl font-semibold text-ink">
            Confirming your payment…
          </h1>
          <p className="mt-1 text-sm text-muted">Just a moment.</p>
        </>
      )}

      {phase === 'success' && (
        <>
          <span className="flex size-16 items-center justify-center rounded-full bg-green-50 text-green-bright">
            <Icon name="check_circle" size={40} fill />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
            Payment successful
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isLoan
              ? "Your repayment has been recorded in your society's ledger."
              : `${amount ? `${naira(amount)} has been ` : 'Your contribution has been '}added to your savings and recorded in your society's ledger.`}
          </p>
          <Button className="mt-6" icon={isLoan ? 'request_quote' : 'home'} onClick={() => navigate(isLoan && loanId ? `/app/loans/${loanId}` : '/app')}>
            {isLoan ? 'Back to loan' : 'Back to home'}
          </Button>
        </>
      )}

      {phase === 'failed' && (
        <>
          <span className="flex size-16 items-center justify-center rounded-full bg-danger-50 text-danger">
            <Icon name="error" size={40} fill />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
            Payment not completed
          </h1>
          <p className="mt-1 text-sm text-muted">
            We couldn't confirm this payment. If you were charged, it will still
            reconcile automatically — check your statement shortly.
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="secondary" onClick={() => navigate(isLoan && loanId ? `/app/loans/${loanId}` : '/app/contribute')}>
              Try again
            </Button>
            <Button onClick={() => navigate('/app')}>Home</Button>
          </div>
        </>
      )}
    </div>
  )
}
