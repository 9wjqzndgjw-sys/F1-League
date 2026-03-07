const CACHE = 'f1-fantasy-__BUILD_ID__'

const PRECACHE = [
  '/',
  '/index.html',
]

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// Activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy:
//  - Supabase API/realtime → network only (never cache)
//  - Navigation requests  → network first, fall back to cached /index.html
//  - Static assets        → cache first, fall back to network
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept Supabase or cross-origin traffic
  if (url.origin !== self.location.origin) return

  // Navigation: network-first so users always get fresh HTML after a deploy,
  // fall back to cached shell only when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put('/index.html', clone))
          }
          return res
        })
        .catch(() =>
          caches.match('/index.html').then(cached =>
            cached || new Response('App offline – please reconnect and refresh.', { status: 503 })
          )
        )
    )
    return
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        // Only cache successful same-origin responses
        if (response.ok && request.method === 'GET' && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
