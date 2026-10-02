/*
  A copy of the shop's items and parties kept on the phone, so the bill, purchase and payment
  forms can still search them without internet. Refreshed while online; read only when a
  request for one of these lists gets no answer at all.
*/
const DB = 'rr-offline-data';
const STORE = 'snap';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(name, value) {
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, name);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}

async function get(name) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(name);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

const who = () => { try { return JSON.parse(localStorage.getItem('rr_session') || 'null')?.data?.user?._id || ''; } catch { return ''; } };

async function fetchAll(api, url, params) {
  const rows = [];
  for (let page = 1; page <= 25; page += 1) {
    const res = await api.get(url, { params: { ...params, page, limit: 200 } });
    rows.push(...(res.data || []));
    if ((res.data || []).length < 200) break;
  }
  return rows;
}

let running = null;
/** Saves the latest items and parties; quietly does nothing if offline or not allowed */
export function refreshOfflineData(api, { items: canItems = true, parties: canParties = true } = {}) {
  if (running || typeof indexedDB === 'undefined' || !navigator.onLine) return running;
  const owner = who();
  if (!owner) return null;
  running = (async () => {
    const [items, parties] = await Promise.all([
      canItems ? fetchAll(api, '/items', { status: 'active' }).catch(() => null) : null,
      canParties ? fetchAll(api, '/parties', { type: 'all', status: 'all' }).catch(() => null) : null,
    ]);
    if (items) await put('items', { owner, at: Date.now(), rows: items });
    if (parties) await put('parties', { owner, at: Date.now(), rows: parties });
  })().catch(() => {}).finally(() => { running = null; });
  return running;
}

const norm = (v) => String(v ?? '').toLowerCase();
const digits = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

/**
 * Answers a list request from the saved copy, in the same shape the server uses.
 * Returns null when the request isn't one we can answer offline.
 */
export async function offlineAnswer(url, params = {}) {
  if (typeof indexedDB === 'undefined') return null;
  const path = String(url || '').split('?')[0].replace(/^\/api/, '');
  const owner = who();
  const limit = Number(params.limit) || 25;
  const q = norm(params.q).trim();

  if (path === '/items') {
    const snap = await get('items').catch(() => null);
    if (!snap || snap.owner !== owner) return null;
    const rows = snap.rows.filter((i) => !q || [i.name, i.sku, i.brand, i.modelNo, i.barcode, i.category].some((f) => norm(f).includes(q)));
    return { success: true, message: 'OK', data: rows.slice(0, limit), meta: { total: rows.length, page: 1, limit, offline: true } };
  }
  if (path === '/parties' || path === '/parties/lookup') {
    const snap = await get('parties').catch(() => null);
    if (!snap || snap.owner !== owner) return null;
    const type = params.type && params.type !== 'all' ? params.type : null;
    if (path === '/parties/lookup') {
      const phone = digits(params.phone);
      const party = snap.rows.find((p) => (!type || p.type === type) && digits(p.phone) === phone) || null;
      return { success: true, message: 'OK', data: { phone, party, takenByOther: false } };
    }
    const rows = snap.rows.filter((p) => (!type || p.type === type)
      && (!params.status || params.status === 'all' || p.status === params.status)
      && (!q || [p.name, p.shopName, p.phone].some((f) => norm(f).includes(q))));
    return { success: true, message: 'OK', data: rows.slice(0, limit), meta: { total: rows.length, page: 1, limit, offline: true } };
  }
  return null;
}
