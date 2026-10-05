import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Load Google Analytics using the measurement ID a platform admin has set.
 *
 * The ID comes from the API rather than the build, so an admin can change it —
 * or switch tracking off by blanking it — without a redeploy. Nothing is
 * injected at all while it is empty.
 *
 * Two deliberate choices about what is sent:
 *
 *  - **Path only, never the query string.** `/reset-password?uid=…&token=…`
 *    carries a live password-reset token, and `?` params would hand it to a
 *    third party. Only `pathname` is reported.
 *  - **No user identifiers.** No email, member number or user id is sent, so
 *    the measurement cannot be tied back to an individual member.
 *
 * `send_page_view` is off because this is a single-page app: gtag would
 * otherwise record only the first load and miss every route change after it.
 */

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const SCRIPT_ID = 'ga-gtag'

function loadGtag(measurementId: string) {
  if (document.getElementById(SCRIPT_ID)) return

  window.dataLayer = window.dataLayer || []
  // The real gtag shim: it must push `arguments` itself, not an array literal.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)
}

export function useGoogleAnalytics(measurementId?: string | null) {
  const id = (measurementId ?? '').trim()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!id) return
    loadGtag(id)
  }, [id])

  useEffect(() => {
    if (!id || !window.gtag) return
    // Path only — see the note above about reset tokens in query strings.
    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
      send_to: id,
    })
  }, [id, pathname])
}
