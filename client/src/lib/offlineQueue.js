/**
 * OFFLINE QUEUE (Part 50) — ab bill banana bhi ismein shaamil hai.
 *
 * PEHLE bill/stock ko is queue se JAAN-BOOJH KAR door rakha gaya tha — dar
 * ye tha ki do phone offline ek hi item bech dein to stock se zyada maal
 * bik chuka dikhega, aur ye khud-ba-khud theek nahi ho sakta.
 *
 * Lekin dobara dekha to pata chala: SERVER PEHLE SE YE JAANCH KARTA HAI —
 * bill jab ASLI me bante hai (chahe abhi ho ya baad me, jab internet wapas
 * aaye), tab stock current hai ya nahi, ye check hota hi hai
 * (`invoice.service.js` me "...ka stock sirf X hai" wala error). Bill ka
 * number bhi TABHI milta hai jab wo server tak asal mein pahunchta hai —
 * pehle se banaya hua nahi hota. Matlab:
 *
 *   - Agar sach me takraav hua (kisi aur ne pehle hi bech diya) — bill
 *     REJECT hota hai, chup-chaap galat nahi banta. Wahi bill "FAILED" list
 *     me chala jata hai, dukaandaar dekh kar theek kar sakta hai.
 *   - Agar sirf internet nahi tha (koi takraav nahi) — bill wapas aane par
 *     seedha ban jata hai, number bhi sahi tarteeb me milta hai.
 *
 * Isliye do alag dabbe:
 *   PENDING — abhi bhejne ki koshish baaki hai (internet ka intezaar).
 *   FAILED  — server ne DEKH KAR mana kiya (jaise stock kam hai) — dobara
 *             try karne se ye apne aap theek nahi hoga, insaan ko dekhna
 *             padega. Isliye ye baaki queue ko roke nahi rakhta.
 */

const DB_NAME = 'rr-offline';
const PENDING_STORE = 'queue';
const FAILED_STORE = 'failed';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FAILED_STORE)) {
        db.createObjectStore(FAILED_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Naya kaam jodo. `kind` sirf pehchan ke liye hai (UI me "3 bill bhejne
 * baaki hain" jaisa dikhane ke liye) — bhejne ka asli kaam `OfflineSync.jsx`
 * ke RUNNERS me `kind` ke hisaab se hota hai.
 */
export const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Entries belong to the login that made them; another person logging in on this phone must not send them
const owner = () => { try { return JSON.parse(localStorage.getItem('rr_session') || 'null')?.data?.user?._id || ''; } catch { return ''; } };

export async function enqueue(kind, payload, id = newKey()) {
  const item = { id, kind, payload, owner: owner(), createdAt: Date.now() };
  await withStore(PENDING_STORE, 'readwrite', (store) => store.put(item));
  notify();
  return item;
}

/* Anyone showing "N entries waiting" listens here */
const listeners = new Set();
export function onQueueChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); }

async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

const mine = (i) => !i.owner || i.owner === owner();
export const listQueue = (kind = null) =>
  getAll(PENDING_STORE).then((all) => all.filter((i) => mine(i) && (!kind || i.kind === kind)));

export const listFailed = (kind = null) =>
  getAll(FAILED_STORE).then((all) => all.filter((i) => mine(i) && (!kind || i.kind === kind)));

async function removePending(id) {
  await withStore(PENDING_STORE, 'readwrite', (store) => store.delete(id));
  notify();
}

async function moveToFailed(item, reason) {
  await withStore(FAILED_STORE, 'readwrite', (store) => store.put({ ...item, failedAt: Date.now(), reason }));
  await removePending(item.id);
}

/** Dukaandaar ne dekh liya, samjhaya, ab hata do */
export async function dismissFailed(id) {
  await withStore(FAILED_STORE, 'readwrite', (store) => store.delete(id));
  notify();
}

/** Failed wapas pending me — dukaandaar ne kuch theek karke phir se bhejne ko bola */
export async function retryFailed(id) {
  const items = await listFailed();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  // New key: the server remembers the old key's rejection and would only replay it
  await withStore(PENDING_STORE, 'readwrite', (store) => store.put({ id: newKey(), kind: item.kind, payload: item.payload, owner: item.owner, createdAt: item.createdAt }));
  await withStore(FAILED_STORE, 'readwrite', (store) => store.delete(id));
  notify();
}

/**
 * Sab pending kaam bhejo, ek-ek karke, tarteeb se (isliye loop, ek saath
 * sab nahi — do bill ek hi second me bane the to unka number bhi wahi
 * tarteeb me milna chahiye jo banane ka tha).
 *
 * DO TARAH KI NAKAAMYABI, DO ALAG JAWAB:
 *   NETWORK HI NAHI PAHUNCHA (`status` khaali) — abhi bhi offline hai,
 *   ya net dheema hai. Yahin ruk jao, baaki sab agli baar ke liye pending
 *   rehte hain — inka number koi cheenta nahi.
 *
 *   SERVER NE DEKH KAR MANA KIYA (`status` koi number hai, jaise 400) —
 *   iska matlab connection theek tha, server tak pahuncha, aur usne
 *   REJECT kiya (jaise "stock kam hai"). Ye dobara try karne se theek
 *   nahi hoga — isliye FAILED me daal do aur AAGE BADH JAO, baaki
 *   pending cheezein isse rukni nahi chahiye.
 */
// Login expired, server busy or restarting, or the same entry still being saved: try again later
const RETRY_LATER = (status) => !status || status === 401 || status === 408 || status === 409 || status === 429 || status >= 500;

let flushing = null;
export function flush(runners, onEvent) {
  // One sync at a time — app start and the "online" event can fire together
  if (!flushing) flushing = doFlush(runners, onEvent).finally(() => { flushing = null; });
  return flushing;
}

async function doFlush(runners, onEvent) {
  const items = (await listQueue()).sort((a, b) => a.createdAt - b.createdAt);
  for (const item of items) {
    const run = runners[item.kind];
    if (!run) { await removePending(item.id); continue; } // pehchana nahi gaya kaam — phasa hua na rahe
    try {
      const res = await run(item.payload, item.id);
      await removePending(item.id);
      onEvent?.({ type: 'done', item, res });
    } catch (err) {
      if (!RETRY_LATER(err?.status)) {
        // Server ne dekh kar mana kiya — dobara try karne se badalne wala nahi
        await moveToFailed(item, err.message || 'Server ne mana kiya');
        onEvent?.({ type: 'failed', item, message: err.message });
        continue; // yahi ek atka, baaki chalte rahenge
      }
      onEvent?.({ type: 'offline', status: err?.status });
      return; // network ya server abhi taiyar nahi — baaki agli baar
    }
  }
}

/**
 * Send now if possible; if there is no network (or it drops mid-way), keep it in the queue
 * under the same key so a request that did reach the server is never saved twice.
 * Returns `{ queued: true }` or `{ queued: false, res }`. Real rejections are thrown.
 */
export async function sendOrQueue(kind, payload, send) {
  const key = newKey();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueue(kind, payload, key);
    return { queued: true };
  }
  try {
    return { queued: false, res: await send(payload, key) };
  } catch (err) {
    if (typeof err?.status !== 'number') {
      await enqueue(kind, payload, key);
      return { queued: true };
    }
    throw err;
  }
}

/**
 * App khulte hi ek baar, aur jab bhi internet WAPAS aaye — dono waqt
 * `flush` khud chal jata hai. Isse har page ko apne aap kuch nahi karna
 * padta, ye ek jagah se sab sambhal leta hai.
 */
export function watchAndFlush(runners, onEvent) {
  const tryFlush = () => { flush(runners, onEvent).catch(() => {}); };
  window.addEventListener('online', tryFlush);
  if (navigator.onLine) tryFlush();
  // "online" isn't fired when the Wi-Fi stays up but the internet behind it comes back
  const id = setInterval(() => { if (navigator.onLine) tryFlush(); }, 60000);
  return () => { window.removeEventListener('online', tryFlush); clearInterval(id); };
}
