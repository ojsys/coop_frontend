// Drives the full web contribution flow with the dev test-checkout:
// contribute → test checkout → pay → callback verify → balance updated.
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
async function balance(tok) {
  const r = await fetch(`${base}/api/v1/members/2/`, {
    headers: { Authorization: `Token ${tok}`, 'X-Cooperative-Id': '1' },
  })
  return (await r.json()).savings_balance
}

const tok = await token('adebayo@example.com', 'member123')
const before = await balance(tok)

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
await page.getByText('Monthly Dues').click() // selects type + fills ₦5,000
await page.waitForTimeout(300)
await page.getByRole('button', { name: /Pay .* securely/ }).click()

// Test checkout should appear
await page.waitForURL('**/app/pay/mock**', { timeout: 8000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${SC}/flow-1-checkout.png` })
const midBalance = await balance(tok) // must NOT have changed yet
console.log('checkout shown; balance still', midBalance)

// Complete the payment
await page.getByRole('button', { name: /^Pay ₦/ }).click()
await page.waitForURL('**/app/pay/callback**', { timeout: 8000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${SC}/flow-2-success.png` })

const after = await balance(tok)
await browser.close()

console.log(`balance: ${before} → (checkout) ${midBalance} → (paid) ${after}`)
const paidDelta = Number(after) - Number(midBalance)
const ok = Number(midBalance) === Number(before) && paidDelta === 5000
console.log('balance unchanged until paid:', Number(midBalance) === Number(before))
console.log('added exactly ₦5,000 after paying:', paidDelta === 5000)
console.log(ok ? 'PASS' : 'FAIL')
if (!ok) process.exit(1)
