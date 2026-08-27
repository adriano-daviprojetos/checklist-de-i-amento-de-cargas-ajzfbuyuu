// Service Worker for Davi Projetos Checklist PWA - Offline-First Strategy
const CACHE_NAME = 'davi-checklist-pwa-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/seal-10-years.svg',
  '/favicon.svg',
  '/favicon.ico',
  '/og-image.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('[SW] Cache addAll warning:', err)
        })
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (PocketBase POST/PATCH/DELETE handled by IndexedDB sync queue)
  if (request.method !== 'GET') {
    return
  }

  // Skip browser extensions or special schemes
  if (!url.protocol.startsWith('http')) {
    return
  }

  // PocketBase API endpoints or /api/ requests: Network First strategy with local fallback
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('pocketbase') ||
    url.hostname.includes('goskip.dev')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and store in cache if valid response
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          }
          return response
        })
        .catch(() => {
          // Network failed, attempt cache
          return caches.match(request).then((cached) => {
            if (cached) return cached
            return new Response(JSON.stringify({ error: 'offline', message: 'Offline mode' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          })
        }),
    )
    return
  }

  // Static Assets (scripts, styles, images, fonts): Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache (stale-while-revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse))
            }
          })
          .catch(() => {
            /* ignore background fetch errors in offline */
          })

        return cachedResponse
      }

      // If not in cache, fetch from network and cache
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          return response
        })
        .catch(() => {
          // If navigating HTML page and offline, return cached root
          if (request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/')
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
    }),
  )
})
