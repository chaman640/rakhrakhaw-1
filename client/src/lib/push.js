import api from '@/lib/api';

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushState = () => (pushSupported() ? Notification.permission : 'unsupported');

function toUint8(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function register() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/** Chalu karo. Jawab: 'on' | 'denied' | 'unsupported' | 'off' */
export async function enablePush() {
  if (!pushSupported()) return 'unsupported';

  const { data } = await api.get('/notifications/push/key');
  if (!data?.ready || !data.publicKey) return 'off';

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';

  const reg = await register();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toUint8(data.publicKey),
  });

  await api.post('/notifications/push/subscribe', sub.toJSON());
  return 'on';
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Pehle se chalu hai ya nahi — button ki halat ke liye */
export async function isPushOn() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await reg?.pushManager.getSubscription());
}
