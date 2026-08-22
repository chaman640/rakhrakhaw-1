import { useCallback, useEffect, useRef, useState } from 'react';
import {
  keyOf, getEntry, subscribe, fetchInto, invalidate, primeCache, subscribeBusy, isBusy,
} from '@/lib/queryCache';

/**
 * PAGE KA DATA LANE KA EK HI TARIKA.
 *
 * Purane tarike me har page me yahi paanch line dohrayi jati thi:
 *
 *     const [rows, setRows] = useState([]);
 *     const [loading, setLoading] = useState(true);
 *     const load = useCallback(async () => { ... }, [deps]);
 *     useEffect(() => { load(); }, [load]);
 *
 * Usme teen dikkat thin: page hamesha khali se shuru hota tha, data kabhi
 * apne aap taaza nahi hota tha, aur kuch save karne ke baad list dobara laana
 * har jagah haath se likhna padta tha.
 *
 * Ab:
 *
 *     const { data: rows = [], loading, refetch } = useQuery(
 *       ['invoices', params],
 *       () => api.get('/invoices', { params }).then((r) => r.data),
 *     );
 *
 * `loading` SIRF tab true hota hai jab data pehli baar aa raha ho. Cache me
 * kuch pada ho to wo turant milta hai aur `loading` false rehta hai — isi se
 * page bina jhilmilaye khulta hai.
 *
 * `refreshing` batata hai ki peeche-peeche naya data aa raha hai — chahein to
 * upar ek patli patti dikha dein, par page rokna nahi hai.
 */
const STALE_MS = 20_000;      // itni der baad data "purana" maan liya jayega
const POLL_MS = 20_000;       // khuli hui screen har itni der me khud dekhegi

export function useQuery(key, fetcher, options = {}) {
  const {
    enabled = true,
    staleTime = STALE_MS,
    // `poll: false` karke band kar sakte hain (jaise bhaari report page pe)
    poll = POLL_MS,
    onError,
  } = options;

  const k = keyOf(key);
  const entry = getEntry(key);

  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  // Fetcher har render pe naya function hota hai — usse dependency me daalna
  // matlab har render pe dobara fetch. Isliye use ref me rakhte hain.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return undefined;
    const now = getEntry(key);
    const hasData = now?.data !== undefined;
    if (hasData) setRefreshing(true);
    try {
      return await fetchInto(key, () => fetcherRef.current(), { force });
    } catch (err) {
      onErrorRef.current?.(err);
      return undefined;
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled]);

  // ---- key badalte hi: purana turant dikhao, naya peeche mangwao ----
  useEffect(() => {
    if (!enabled) return undefined;

    /*
      Cache me kuch bhi hile to do kaam:

        1. screen dobara bana do (naya data aa gaya hoga)
        2. agar kisi ne "ye purana ho gaya" ka nishaan lagaya hai (`dirty`) to
           usi waqt naya maang lo

      Doosra kaam hi wo hai jo "save to ho gaya par list me dikha hi nahi"
      wali shikayat rokta hai — bill banaya, khata usi pal taaza; supplier
      joda, list me usi pal aaya.
    */
    const onCacheChange = () => {
      rerender();
      const now = getEntry(key);
      if (now?.dirty && !now.promise) run();
    };
    const unsub = subscribe(key, onCacheChange);

    const cur = getEntry(key);
    const stale = !cur || cur.data === undefined || (Date.now() - (cur.at || 0)) > staleTime;
    if (stale) run();

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled]);

  // ---- screen pe wapas aate hi taaza ----
  //
  // Dukaandaar WhatsApp khol kar wapas aata hai, ya doosre tab se lautta hai —
  // us waqt purana data dikhna sabse bura hota hai, kyunki wo usi pe bharosa
  // karke agla kaam karta hai.
  useEffect(() => {
    if (!enabled) return undefined;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      const cur = getEntry(key);
      if (!cur || (Date.now() - (cur.at || 0)) > staleTime) run();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled, staleTime]);

  // ---- har 20 second me khud dekh lena ----
  //
  // Sirf tab jab screen saamne ho. Peeche pade tab me bhi chalta rehta to
  // bina wajah net aur battery khaata — aur server pe bhi bojh padta.
  useEffect(() => {
    if (!enabled || !poll) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, poll);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled, poll]);

  const hasData = entry?.data !== undefined;

  return {
    data: entry?.data,
    // Pehli baar hi "load ho raha hai" dikhega — uske baad kabhi nahi
    loading: enabled && !hasData && !entry?.error,
    refreshing,
    error: hasData ? null : (entry?.error || null),
    refetch: () => run({ force: true }),
  };
}

/**
 * List wale page ke liye chhota rasta.
 *
 * Hamare saare list endpoint ek hi shakal me jawab dete hain:
 * `{ data: [...], meta: { page, limit, total, totalPages } }`.
 * Isliye har page me wahi do line likhne ke bajaye seedha `rows` aur `meta`
 * de dete hain — aur khali halat me bhi `rows` hamesha ek array hi rehta hai,
 * taaki `rows.map` kabhi na phate.
 */
const EMPTY_META = { page: 1, limit: 25, total: 0, totalPages: 1 };

export function useListQuery(key, fetcher, options) {
  const q = useQuery(key, fetcher, options);
  return {
    ...q,
    rows: q.data?.data || [],
    meta: q.data?.meta || EMPTY_META,
  };
}

/**
 * Kuch badla — jo list uspe tiki hai wo dobara mangwa lo.
 *
 * Bill banane ke baad: `bust('invoices', 'khata', 'dashboard')`
 *
 * Ye har page me haath se `load()` likhne se behtar hai: naya page jodne
 * wale ko sirf itna sochna hai ki "maine kya badla", ye nahi ki "iska asar
 * kaunse kaunse page pe padega".
 */
/*
  Mutation ka jawab seedha cache me — `bust()` + dobara fetch ke bajaye.

  `bust()` tab theek hai jab aapko pata ho ki KUCH badla par naya sach aapke
  paas nahi hai. Jab server ne poora naya jawab de hi diya ho, tab dobara
  mangwana sirf ek bekaar ka chakkar hai.
*/
export function prime(key, data) {
  return primeCache(key, data);
}

export function bust(...prefixes) {
  for (const p of prefixes) invalidate(p);
}

/**
 * "Kahin kuch aa raha hai kya?" — sabse upar wali patli patti ke liye.
 *
 * Ek pench hai: har 20 second me apne aap check hota hai, aur wo check aksar
 * aadhe second me poora ho jata hai. Har baar patti chamkane lagti to screen
 * pe ek jhilmilahat lag jati — kaam karte aadmi ko wo khatakti hai.
 *
 * Isliye patti THODA RUK KAR aati hai. Jo request jaldi ho jayen (yaani
 * zyadatar) unke liye kabhi dikhti hi nahi. Sirf jab net sach me dheema ho —
 * tabhi, jab batana zaroori ho jata hai.
 */
const BUSY_DELAY_MS = 500;

export function useIsFetching() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer = null;
    const onBusy = (busy) => {
      if (busy) {
        if (timer === null) timer = setTimeout(() => { timer = null; setShow(true); }, BUSY_DELAY_MS);
      } else {
        if (timer !== null) { clearTimeout(timer); timer = null; }
        setShow(false);
      }
    };
    onBusy(isBusy());
    const unsub = subscribeBusy(onBusy);
    return () => { if (timer !== null) clearTimeout(timer); unsub(); };
  }, []);

  return show;
}
