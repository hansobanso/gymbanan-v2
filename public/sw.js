const CACHE = 'gymbanan-v17'
const PRECACHE = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = e.request.url
  // Passera igenom API-anrop utan cache
  if (url.includes('supabase.co') || url.includes('workers.dev')) return
  // Manifest-filer hamtas alltid farskt sa ratt PWA-manifest lases
  // (admin vs huvudapp). Cacha dem aldrig.
  if (url.includes('manifest')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }

  // Navigeringar och index.html: ALLTID farskt fran natet (med cache bara
  // som offline-reserv). Utan detta kan en gammal cachad index.html peka pa
  // borttagna JS-chunkar sa ny kod aldrig laddas efter en deploy.
  if (e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
