// Verifies the member PWA works offline: loads /app online (populating the SW
// cache), then goes offline and reloads, asserting the app shell + cached data
// still render. Run against the production preview server (:4173).
import { chromium } from 'playwright'

const base = 'http://localhost:4173'

const res = await fetch(`${base}/api/v1/auth/token/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'adebayo@example.com', password: 'member123' }),
})
const { token } = await res.json()
if (!token) throw new Error('login failed')

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 900, height: 940 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()
await page.addInitScript(
  ([t, c]) => {
    localStorage.setItem('coop.token', t)
    localStorage.setItem('coop.activeCooperativeId', c)
  },
  [token, '1'],
)

// 1) First online load — registers & activates the SW (it does not control this
//    navigation, so its API reads aren't cached yet — exactly like a real first visit).
await page.goto(`${base}/app/savings`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15000 })

// 2) Second online load — now the SW controls the page and caches the API reads.
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const controlling = await page.evaluate(() => navigator.serviceWorker?.controller != null)

// 3) Go offline and reload — must still render the shell AND the cached data.
await context.setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const bodyText = (await page.textContent('body')) ?? ''
const shellOk = bodyText.includes('My savings')
const dataOk = /₦\s?35,000/.test(bodyText)

await page.screenshot({
  path: '/private/tmp/claude-501/-Users-Apple-Desktop-coop/a8e3ea6e-aac5-4820-8d7d-654d1703e0d4/scratchpad/m-offline.png',
})
await browser.close()

console.log('service worker controlling:', controlling)
console.log('offline shell rendered    :', shellOk)
console.log('offline cached data shown :', dataOk)
if (!shellOk || !dataOk) process.exit(1)
