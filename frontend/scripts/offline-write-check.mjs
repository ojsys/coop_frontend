// Verifies the offline WRITE queue end-to-end against the production preview:
// go offline, cast a vote (it queues), go back online, and confirm it syncs to
// the backend. Run with the preview server on :4173.
import { chromium } from 'playwright'

const base = 'http://localhost:4173'

async function token(username, password) {
  const r = await fetch(`${base}/api/v1/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return (await r.json()).token
}

async function forVotes(adminTok) {
  const r = await fetch(`${base}/api/v1/resolutions/`, {
    headers: { Authorization: `Token ${adminTok}`, 'X-Cooperative-Id': '1' },
  })
  const d = await r.json()
  const list = d.results ?? d
  return list.find((x) => x.id === 1).results.for
}

const memberTok = await token('adebayo@example.com', 'member123')
const adminTok = await token('admin@startupripple.co', 'adminpass')
const before = await forVotes(adminTok)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 420, height: 900 } })
const page = await context.newPage()
await page.addInitScript(
  ([t]) => {
    localStorage.setItem('coop.token', t)
    localStorage.setItem('coop.activeCooperativeId', '1')
  },
  [memberTok],
)

// Warm the SW so the shell is offline-capable, then let it control the page.
await page.goto(`${base}/app/vote`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15000 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// Go offline and cast a vote — it should queue, not error.
await context.setOffline(true)
await page.waitForFunction(() => navigator.onLine === false, { timeout: 5000 })
await page.getByRole('button', { name: 'For', exact: true }).first().click()

// Prove it was queued *while offline* (not sent to the server).
let queued = false
try {
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('coop.outbox') || '[]').length === 1,
    { timeout: 6000 },
  )
  queued = true
} catch {
  queued = false
}
const bannerOffline = (await page.textContent('body')).includes("You're offline")
await page.screenshot({
  path: '/private/tmp/claude-501/-Users-Apple-Desktop-coop/a8e3ea6e-aac5-4820-8d7d-654d1703e0d4/scratchpad/m-offline-vote.png',
})

// Reconnect — the queue should flush automatically.
await context.setOffline(false)
await page.waitForFunction(
  () => JSON.parse(localStorage.getItem('coop.outbox') || '[]').length === 0,
  { timeout: 10000 },
)
await page.waitForTimeout(800)
const drained = await page.evaluate(() => JSON.parse(localStorage.getItem('coop.outbox') || '[]').length)
await browser.close()

const after = await forVotes(adminTok)

console.log('vote queued while offline :', queued)
console.log('offline banner shown      :', bannerOffline)
console.log('queue drained after online:', drained === 0)
console.log(`backend "for" votes        : ${before} -> ${after}`)
const ok = queued && bannerOffline && drained === 0 && after >= 1
console.log(ok ? 'PASS' : 'FAIL')
if (!ok) process.exit(1)
