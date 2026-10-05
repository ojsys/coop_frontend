import { useEffect } from 'react'

/** Shipped with the build; used until a society uploads its own mark. */
const DEFAULT_ICON = '/favicon.svg'

/**
 * Point the browser tab at the active society's favicon.
 *
 * index.html hard-codes the CooperativeOS icon, so a white-labelled society
 * would otherwise keep showing our mark in the tab no matter what it uploaded.
 */
export function useFavicon(url?: string | null) {
  useEffect(() => {
    const href = url || DEFAULT_ICON

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    // Compare the raw attribute: the .href getter resolves to an absolute URL,
    // so comparing against a relative path would always look like a change.
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }, [url])
}
