// Drives contribute → Pay and captures whether the REAL Paystack checkout iframe
// opens (vs the local mock). Uses a placeholder public key, so Paystack loads its
// checkout and reports the key state — proving the flow reaches genuine Paystack.
import { chromium } from 'playwright'

const base = 'http://localhost:5173'
const SC = '/private/tmp/claude-501/-Users-Apple-Desktop-coop/a8e3ea6e-aac5-4820-8d7d-654d1703e0d4/scratchpad'

async function token(u, p) {
  const r = await fetch(`${base}/api/v1/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  })
  return (await r.json()).token
}

const tok = await token('adebayo@example.com', 'member123')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
await page.addInitScript(
  ([t]) => {
    localStorage.setItem('coop.token', t)
    localStorage.setItem('coop.activeCooperativeId', '1')
  },
  [tok],
)

await page.goto(`${base}/app/contribute`, { waitUntil: 'networkidle' })
await page.getByText('Monthly Dues').click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /Pay .* securely/ }).click()

// Wait for the Paystack iframe to appear
await page.waitForTimeout(5000)
const frames = page.frames().map((f) => f.url())
const paystackFrame = frames.find((u) => u.includes('paystack'))
await page.screenshot({ path: `${SC}/paystack-modal.png` })
await browser.close()

console.log('Paystack checkout iframe present:', !!paystackFrame)
console.log('iframe url:', paystackFrame || '(none)')
