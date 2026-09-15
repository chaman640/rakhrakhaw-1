/* Rakh Rakhav — phone pe notification (SMS nahi, app ke through) + OFFLINE (Part 48). */

/*
  OFFLINE — teen tarah ki cheez, teen alag tarike se (Part 48):
  chauk jaise bazaar me signal aksar gayab rehta hai — app khulna hi na to
  baaki kuch mayne nahi rakhta.

    1. APP KA DHAANCHA (JS/CSS/HTML) — "cache first": ek baar mil jaye to
       hamesha wahi tez chalta hai. Vite har build me naya filename banata
       hai (hash ke saath), isliye purana cache khud hi bekar ho jata hai —
       purana hata-ne ki chinta nahi karni padti.

    2. GET WALI API (item list, retailer list, khata, bill) — "network
       pehle, mile to cache bhi kar lo; na mile to jo aakhri baar mila tha
       wahi dikha do". Isse purana (thoda bhi) data dikhna, kuch na dikhne
       se hamesha behtar hai.

    3. LIKHNE WALI API (POST/PUT/DELETE) — YAHAN CACHE NAHI HOTA. Bill
       banana, stock ghatana, paisa lena — inme do device offline ek saath
       kaam karein to hisaab hi galat ho sakta hai (do jagah stock kat
       jaana, bill number takra jaana). Isliye safe likhne wale kaam
       (jaise expense) client ki apni queue se sambhalte hain
       (`offlineQueue.js`) — service worker inhe chhuta tak nahi.
*/

const SHELL_CACHE = 'rr-shell-v1';
const API_CACHE = 'rr-api-v1';

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Purana version ka cache saaf — naya deploy aate hi
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
        .map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // likhne wala kaam — isse door hi rehna hai

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // sirf apni hi cheezein

  // Page khud (HTML) — offline ho to bhi app ka khaka khulna chahiye
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // API GET — network pehle, cache dusra sahara. Login/session wali API
  // (/api/auth/*) yahan se bahar — warna isi phone pe koi doosra login kare
  // to offline me thodi der ke liye PURANE user ka data dikh sakta hai.
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        throw new Error('offline aur kuch cached bhi nahi hai');
      }
    })());
    return;
  }

  // Baaki sab (JS/CSS/images) — mila hua hamesha kaam ka hai (Vite naam me hash daalta hai)
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }

  const title = d.title || 'Rakh Rakhav';
  const options = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    /*
      `tag` se ek hi cheez ke do alert dher nahi lagate — naya purane ki jagah
      le leta hai. Bina iske das order aane par phone pe das line ban jati hai.
    */
    tag: d.type || 'rr',
    renotify: true,
    data: { link: d.link || '/', id: d.id || '' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // App pehle se khuli ho to usi tab ko aage lao — naya tab kholna chidhata hai
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) await c.navigate(link).catch(() => {});
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(link);
  })());
});
