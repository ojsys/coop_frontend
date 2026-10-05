// Loads Paystack's Inline checkout (js.paystack.co) on demand and opens the real
// Paystack modal. This is the on-page "Paystack checkout" — Paystack collects the
// card / bank / USSD details inside its own iframe; we never touch them. On
// success we verify server-side before anything posts to the ledger.

declare global {
  interface Window {
    PaystackPop?: {
      setup(opts: Record<string, unknown>): { openIframe(): void }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Paystack. Check your connection.'))
    }
    document.body.appendChild(s)
  })
  return scriptPromise
}

export interface PaystackOptions {
  publicKey: string
  email: string
  amountKobo: number
  reference: string
  subaccount?: string | null
  onSuccess: (reference: string) => void
  onClose: () => void
}

export async function openPaystackCheckout(opts: PaystackOptions): Promise<void> {
  await loadScript()
  const PaystackPop = window.PaystackPop
  if (!PaystackPop) throw new Error('Paystack unavailable')

  const handler = PaystackPop.setup({
    key: opts.publicKey,
    email: opts.email,
    amount: opts.amountKobo,
    ref: opts.reference,
    currency: 'NGN',
    ...(opts.subaccount ? { subaccount: opts.subaccount } : {}),
    // Paystack Inline v1 requires a synchronous callback.
    callback: (response: { reference: string }) => opts.onSuccess(response.reference),
    onClose: opts.onClose,
  })
  handler.openIframe()
}
