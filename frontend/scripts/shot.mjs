// Reusable authenticated screenshot helper for visual verification.
//   node scripts/shot.mjs <email> <password> <coopId|-> <path> <outfile> [width] [height]
import { chromium } from 'playwright'

const [, , email, password, coopId, routePath, out, w = '1440', h = '1000'] =
  process.argv

const base = 'http://localhost:5173'

// Get a token straight from the API, then seed localStorage the way AuthContext does.
const res = await fetch(`${base}/api/v1/auth/token/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: email, password }),
})
const { token } = await res.json()
if (!token) throw new Error('login failed')

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
})
await page.addInitScript(
  ([t, c]) => {
    localStorage.setItem('coop.token', t)
    if (c && c !== '-') localStorage.setItem('coop.activeCooperativeId', c)
  },
  [token, coopId],
)
await page.goto(`${base}${routePath}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log('wrote', out)
