/**
 * Chhota sa memory cache — sirf un jawabon ke liye jo bahut baar mangte hain
 * aur bahut kam badalte hain.
 *
 * Redis JAAN-BOOJH KAR nahi. Ek aur cheez chalana, uska bill, aur uske fail
 * hone par kya ho — ye teeno ka daam is faayde se zyada hai. Ek lakh user pe
 * bhi asli bojh database pe padta hai, aur wahi yahan se ghatta hai.
 *
 * Kai server chal rahe hon to har server ka apna cache hoga. Us se sirf itna
 * hota hai ki naya data kuch second baad dikhta hai — aur jo cheezein yahan
 * rakhi jati hain (plan ki list, business ka naam) unme wo bilkul chalta hai.
 */
const store = new Map();

/*
  Hadd zaroori hai. Bina iske ek galat key (jaise har request ka apna id) cache
  ko chupchap badhata rehta hai aur ek din server ki memory kha jata hai — aur
  wo crash 3 baje raat ko aata hai.
*/
const MAX = 2000;

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.till < Date.now()) { store.delete(key); return undefined; }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = 60000) {
  if (store.size >= MAX) {
    // Sabse purani chauthai hata do — poora saaf karna har baar sab dobara
    // database se mangwata hai, aur wahi wo pal hota hai jab bhaar sabse zyada hai
    const drop = Math.ceil(MAX / 4);
    let i = 0;
    for (const k of store.keys()) { store.delete(k); if (++i >= drop) break; }
  }
  store.set(key, { value, till: Date.now() + ttlMs });
  return value;
}

/** Cache se lo, na mile to lao aur rakh do */
export async function cached(key, ttlMs, fn) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  return cacheSet(key, await fn(), ttlMs);
}

/** Kuch badal gaya — us naam se shuru hone wali sab key hata do */
export function cacheBust(prefix) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

export const cacheSize = () => store.size;
