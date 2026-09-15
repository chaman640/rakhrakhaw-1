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
export async function enqueue(kind, payload) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    payload,
    createdAt: Date.now(),
  };
  await withStore(PENDING_STORE, 'readwrite', (store) => store.put(item));
  return item;
}

async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export const listQueue = (kind = null) =>
  getAll(PENDING_STORE).then((all) => (kind ? all.filter((i) => i.kind === kind) : all));

export const listFailed = (kind = null) =>
  getAll(FAILED_STORE).then((all) => (kind ? all.filter((i) => i.kind === kind) : all));

async function removePending(id) {
  await withStore(PENDING_STORE, 'readwrite', (store) => store.delete(id));
}

async function moveToFailed(item, reason) {
  await withStore(FAILED_STORE, 'readwrite', (store) => store.put({ ...item, failedAt: Date.now(), reason }));
  await removePending(item.id);
}

/** Dukaandaar ne dekh liya, samjhaya, ab hata do */
export async function dismissFailed(id) {
  await withStore(FAILED_STORE, 'readwrite', (store) => store.delete(id));
}

/** Failed wapas pending me — dukaandaar ne kuch theek karke phir se bhejne ko bola */
export async function retryFailed(id) {
  const items = await listFailed();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  await withStore(PENDING_STORE, 'readwrite', (store) => store.put({ id: item.id, kind: item.kind, payload: item.payload, createdAt: item.createdAt }));
  await withStore(FAILED_STORE, 'readwrite', (store) => store.delete(id));
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
export async function flush(runners, onEvent) {
  const items = (await listQueue()).sort((a, b) => a.createdAt - b.createdAt);
  for (const item of items) {
    const run = runners[item.kind];
    if (!run) { await removePending(item.id); continue; } // pehchana nahi gaya kaam — phasa hua na rahe
    try {
      await run(item.payload);
      await removePending(item.id);
      onEvent?.({ type: 'done', item });
    } catch (err) {
      if (typeof err?.status === 'number') {
        // Server ne dekh kar mana kiya — dobara try karne se badalne wala nahi
        await moveToFailed(item, err.message || 'Server ne mana kiya');
        onEvent?.({ type: 'failed', item, message: err.message });
        continue; // yahi ek atka, baaki chalte rahenge
      }
      onEvent?.({ type: 'offline' });
      return; // network hi nahi pahuncha — yahin ruk jao, baaki agli baar
    }
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
  return () => window.removeEventListener('online', tryFlush);
}
