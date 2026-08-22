/**
 * PAGE TURANT KHULNA CHAHIYE.
 *
 * Pehle har page khulte hi khali hota tha, phir server se data aata tha, tab
 * kuch dikhta tha. Ek page se doosre page jaane me har baar wahi ruk-ruk kar
 * chalna. Dukaandaar ko lagta tha "app dheema hai" — jabki data pehle se ek
 * baar aa hi chuka tha.
 *
 * Ab niyam ye hai:
 *
 *   1. PURANA TURANT      — jo pehle aa chuka hai wo bina ek pal ruke dikha do
 *   2. NAYA PEECHE-PEECHE — usi waqt server se dobara poochho
 *   3. AA GAYA TO BADAL DO — naya aate hi screen apne aap taaza ho jaye
 *
 * Isse page kabhi khali nahi dikhta, aur data kabhi purana nahi rehta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ye file sirf DABBA hai (data kahan pada hai). React se iska koi lena-dena
 * nahi — usse `hooks/useQuery.js` sambhalta hai. Do hisso me isliye rakha ki
 * cache ko bina browser ke bhi test kiya ja sake.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Key hamesha ek hi shakal me.
 *
 * `['invoices', { page: 1 }]` aur `['invoices', { page: 1 }]` ek hi cheez
 * hain — par do alag object hain. Isliye unhe likhaayi me badal kar milate
 * hain. Object ke andar ki chaabiyan sort karte hain, warna
 * `{a:1,b:2}` aur `{b:2,a:1}` do alag key ban jate.
 */
export function keyOf(key) {
  const norm = (v) => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === 'object') {
      return Object.keys(v).sort().reduce((acc, k) => {
        if (v[k] !== undefined && v[k] !== '') acc[k] = norm(v[k]);
        return acc;
      }, {});
    }
    return v;
  };
  return JSON.stringify(norm(Array.isArray(key) ? key : [key]));
}

/** key -> { data, at, error, promise, seq } */
const store = new Map();

/** key -> Set(listener) */
const listeners = new Map();

// Har fetch ko ek ginti milti hai. Jawab aane par agar ginti purani ho gayi
// hai (yaani beech me nayi request chal padi), to us jawab ko phenk dete
// hain. Bina iske DHEEMA jawab TEZ jawab ke upar chipak jata hai aur screen
// pe purana data dikhne lagta hai — pakadna bahut mushkil bug hai.
let seqCounter = 0;

export function getEntry(key) {
  return store.get(keyOf(key)) || null;
}

export function peek(key) {
  return getEntry(key)?.data;
}

function emit(k) {
  const set = listeners.get(k);
  if (!set) return;
  for (const fn of set) fn();
}

export function subscribe(key, fn) {
  const k = keyOf(key);
  if (!listeners.has(k)) listeners.set(k, new Set());
  listeners.get(k).add(fn);
  return () => {
    const set = listeners.get(k);
    if (!set) return;
    set.delete(fn);
    if (!set.size) listeners.delete(k);
  };
}

/**
 * Data lao.
 *
 * Ek hi cheez ke liye do jagah se ek saath maanga jaye (jaise list aur ginti
 * dono ek hi key pe) to server ko sirf EK request jayegi — chalti hui request
 * ka wahi vaada dobara de dete hain.
 */
/*
  Abhi kitni request chal rahi hain.

  Isse upar wali patli patti chalti hai. Ginti isliye rakhi hai, sirf sach/jhoot
  nahi: ek page pe teen list ek saath aati hain — teeno ke poora hone tak patti
  chalti rehni chahiye, pehli ke aate hi band nahi.
*/
let inflight = 0;
const busyListeners = new Set();

function bumpBusy(n) {
  inflight = Math.max(0, inflight + n);
  for (const fn of busyListeners) fn(inflight > 0);
}

export function subscribeBusy(fn) {
  busyListeners.add(fn);
  return () => busyListeners.delete(fn);
}

export function isBusy() {
  return inflight > 0;
}

export async function fetchInto(key, fetcher, { force = false } = {}) {
  const k = keyOf(key);
  const entry = store.get(k) || {};

  // Pehle se chal rahi request ka wahi vaada — ise dobara nahi ginte
  if (entry.promise && !force) return entry.promise;

  bumpBusy(+1);
  const seq = ++seqCounter;
  const promise = (async () => {
    try {
      const data = await fetcher();
      const now = store.get(k) || {};
      // Beech me koi nayi request chal padi thi? Tab ye jawab purana hai.
      if (now.seq && now.seq > seq) return now.data;
      store.set(k, { data, at: Date.now(), error: null, promise: null, seq });
      emit(k);
      return data;
    } catch (error) {
      const now = store.get(k) || {};
      if (now.seq && now.seq > seq) return now.data;
      // Purana data mat phenko — error dikha denge par screen khali nahi hogi
      store.set(k, { ...now, error, promise: null, seq });
      emit(k);
      throw error;
    } finally {
      bumpBusy(-1);
    }
  })();

  // `dirty: false` — maang li hai, ab dobara maangne ki zarurat nahi
  store.set(k, { ...entry, promise, seq, dirty: false });
  return promise;
}

/*
  SERVER SE ABHI-ABHI MILA JAWAB SEEDHA CACHE ME RAKH DO.

  Hamare bahut se mutation apne aap poori nayi cheez wapas dete hain — cart me
  quantity badlo to naya poora cart hi milta hai. Aise me cache ko "purana"
  bata kar dobara mangwana do baar ka kaam hai: ek round-trip bekaar jata hai,
  aur beech ke us pal me screen purana number dikhati hai.

  `seq` yahan bhi badhaya jata hai, aur wahi is chhote se function ka asli
  kaam hai: agar peeche koi purani request abhi bhi chal rahi ho, to lautne
  par uska jawab is naye sach ke UPAR nahi chipkega.
*/
export function primeCache(key, data) {
  const k = keyOf(key);
  const entry = store.get(k) || {};
  store.set(k, { ...entry, data, at: Date.now(), error: null, promise: null, seq: ++seqCounter });
  emit(k);
  return data;
}

/**
 * Kuch badal gaya — jo bhi is naam se shuru hota hai wo sab purana maan lo.
 *
 * Bill banane ke baad `invalidate('invoices')` — invoice ki list, ginti,
 * dashboard, sab apne aap dobara aa jayenge. Yahi wo jagah hai jise likhna
 * bhool jane par "save to ho gaya par list me dikha hi nahi" wali shikayat
 * aati hai.
 */
export function invalidate(prefix) {
  const needle = JSON.stringify(prefix);
  const hit = needle.slice(1, -1);   // quotes hata do — key ke andar khojenge

  for (const k of [...store.keys()]) {
    if (!k.includes(hit)) continue;
    const entry = store.get(k);

    /*
      DO nishaan lagte hain, aur dono ki alag zarurat hai:

        at = 0      → "ye data purana hai". Ye page BAAD me khulega tab kaam
                      aata hai — khulte hi naya maang lega.

        dirty       → "abhi ke abhi dobara maango". Ye USI page ke liye hai jo
                      is waqt khula hua hai.

      Sirf `at = 0` kaafi nahi tha, aur yahi ek asli bug ban gaya tha: supplier
      add karo, toast aata tha "add ho gaya" — aur neeche list waisi ki waisi
      "Abhi koi supplier nahi" dikhati rehti thi. Wajah ye ki khula hua page
      apni key badalta hi nahi, isliye uska "naya maango" wala hissa dobara
      chalta hi nahi tha. Data 20 second baad khud aata tha — tab tak
      dukaandaar ko lagta tha ki save hua hi nahi, aur wo dobara add karta tha.

      `dirty` ko fetch shuru hote hi hata dete hain — isliye jawab galat aane
      par ye apne aap dobara-dobara nahi maangta rehta.
    */
    store.set(k, { ...entry, at: 0, dirty: true });
    emit(k);
  }
}

/** Logout pe sab kuch bhool jao — warna agla user purana data dekh lega */
export function clearCache() {
  store.clear();
  for (const k of [...listeners.keys()]) emit(k);
}

/** Test ke liye */
export const __store = store;
