/* Rakh Rakhav — phone pe notification. SMS nahi, app ke through. */

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
