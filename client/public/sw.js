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

const SHELL_CACHE = 'rr-shell-v3'; // v2 dropped wrongly cached /api/auth responses; v3 precaches the whole app
const API_CACHE = 'rr-api-v1';

// Keep every app file on the phone, so pages never opened before still work without internet
async function precache() {
  try {
    const res = await fetch('/precache.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const { files = [] } = await res.json();
    const cache = await caches.open(SHELL_CACHE);
    // Hashed files never change, so fetch only the missing ones; index.html etc. are always refreshed
    await Promise.allSettled(files.map((f) => (f.startsWith('/assets/') ? cache.match(f).then((hit) => hit || cache.add(f)) : cache.add(f))));
    return files;
  } catch { return []; }
}

self.addEventListener('install', (e) => e.waitUntil(precache().then(() => self.skipWaiting())));

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Purana version ka cache saaf — naya deploy aate hi
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
        .map((k) => caches.delete(k)),
    );
    // Drop page files from older deploys so the cache doesn't keep growing
    const files = await precache();
    if (files.length) {
      const keep = new Set(files.map((f) => new URL(f, self.location.origin).href));
      const cache = await caches.open(SHELL_CACHE);
      for (const req of await cache.keys()) {
        if (new URL(req.url).pathname.startsWith('/assets/') && !keep.has(req.url)) await cache.delete(req);
      }
    }
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
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Session/login API: always live, never cached (it is per-user)
  if (url.pathname.startsWith('/api/auth/')) return;

  // API GET — network pehle, cache dusra sahara (offline ke liye)
  if (url.pathname.startsWith('/api/')) {
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
