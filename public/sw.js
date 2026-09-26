const CACHE = 'app-cache-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return
  if (url.origin !== self.location.origin) return

  // Hashed, immutable build assets - cache-first, never revalidate the same URL.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        }
        return response
      }))
    )
    return
  }

  // Navigation and everything else - network-first so a new deploy is seen
  // right away, falling back to cache when offline.
  event.respondWith(
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        const copy = response.clone()
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
      }
      return response
    }).catch(() => caches.match(request))
  )
})
