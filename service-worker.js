// SISCOF — Service Worker v3
// Carabineros de Chile · Prefectura Arica Nro. 1

const CACHE_NAME = 'siscof-v3'
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/siscof.css',
  './js/config.js',
  './js/offline.js',
  './js/idfi.js',
  './js/alerts.js',
  './js/core.js',
  './js/pages/login.js',
  './js/pages/app.js',
  './js/pages/dashboard.js',
  './js/pages/registro.js',
  './js/pages/historial.js',
  './js/pages/maestras.js',
  './js/pages/admin.js',
  './js/pages/usuarios.js',
  './img/escudo-carabineros.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  // Solo interceptar GET
  if (e.request.method !== 'GET') return
  // Supabase: siempre intentar red primero
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    )
    return
  }
  // Assets: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        return res
      })
    })
  )
})
