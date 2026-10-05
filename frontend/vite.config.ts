import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// The React app runs on :5173; the Django API on :8000. We proxy /api in dev so
// the browser sees a same-origin request (no CORS preflight) and the token +
// X-Cooperative-Id headers flow straight through.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      // SW is off in dev to avoid caching churn; it activates in the prod build.
      devOptions: { enabled: false },
      manifest: {
        name: 'CooperativeOS',
        short_name: 'CoopOS',
        description: 'Your cooperative — contributions, savings, statements and voting.',
        start_url: '/app',
        scope: '/app',
        display: 'standalone',
        background_color: '#0b4f3a',
        theme_color: '#0b4f3a',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // SPA fallback so member routes resolve offline; never for API calls.
        navigateFallback: '/index.html',
        // Must mirror the prefixes config/urls.py excludes from the SPA
        // catch-all. Anything server-rendered that is missing here gets
        // answered with the cached SPA shell instead of reaching Django —
        // which is how /admin/ ended up bouncing to the platform dashboard.
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/api-auth/,
          /^\/admin/,
          /^\/media/,
          /^\/static/,
        ],
        runtimeCaching: [
          {
            // Member reads (savings, statement, votes) work offline: online-first,
            // fall back to the last cached response when the network is down.
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'coop-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      // Uploaded logos/favicons come back as /media/... URLs. Without this the
      // browser would resolve them against :5173 and 404 in development.
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  // `npm run preview` serves the production build (with the service worker); it
  // needs the same /api proxy so offline caching can be verified end-to-end.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
