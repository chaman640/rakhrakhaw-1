import { useEffect, useRef } from 'react';

/**
 * BINA REFRESH DABAYE, SCREEN KHUD TAAZA.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ye kyun chahiye tha
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `useQuery` wale page pehle se khud taaza hote hain. Par aadhe page —
 * Items, Activity, aur poora retailer wala hissa — seedha `api.get` se data
 * lete hain, aur wo ek baar load hokar wahin jam jate hain.
 *
 * Dukaan me iska matlab ye nikalta hai: godown wala phone pe Items page khol
 * kar rakhta hai, malik counter se rate badal deta hai, aur godown wale ko
 * ghanton tak purana rate dikhta rehta hai. Retailer catalog subah khol kar
 * jeb me rakh leta hai aur shaam ko us purani tasveer se order kar deta hai.
 * Dono halat me galti app ki dikhti hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Do mauke, dono zaroori
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   1. SCREEN PE WAPAS AANA — WhatsApp se lauto, ya doosra tab chhodo. Yahi
 *      wo pal hai jab purana data sabse zyada nuksaan karta hai, kyunki aadmi
 *      usi pe bharosa karke agla kaam karta hai.
 *   2. KHULI SCREEN — page saamne pada ho to har 20 second me khud dekh lena.
 *
 * Dono ke saath ek hi shart: **screen saamne ho tabhi**. Peeche pade tab me
 * chalte rehna bina wajah net aur battery khaata hai, aur server pe bhi bojh
 * daalta hai — sirf isliye ki kisi ne tab band karna bhool gaya.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `chupChaap` ka matlab
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Loader ko `true` bhejte hain: "list khali karke skeleton mat dikhao, bas
 * badal do". Bina iske har 20 second me poori list gayab hokar wapas aati —
 * aur wo tootne jaisa dikhta hai, taaza hone jaisa nahi.
 */
const POLL_MS = 20_000;

export function useAutoRefresh(load, { poll = POLL_MS, enabled = true } = {}) {
  // Ref isliye ki `load` har render pe naya function hota hai. Use seedha
  // dependency me daalte to timer har render pe toot kar dobara banta — yani
  // kabhi poora hota hi nahi, aur poll chalta hi nahi.
  const ref = useRef(load);
  ref.current = load;

  useEffect(() => {
    if (!enabled) return undefined;

    const taaza = () => {
      if (document.visibilityState !== 'visible') return;
      ref.current?.(true);
    };

    window.addEventListener('focus', taaza);
    document.addEventListener('visibilitychange', taaza);
    const id = poll ? setInterval(taaza, poll) : null;

    return () => {
      window.removeEventListener('focus', taaza);
      document.removeEventListener('visibilitychange', taaza);
      if (id) clearInterval(id);
    };
  }, [poll, enabled]);
}

export default useAutoRefresh;
