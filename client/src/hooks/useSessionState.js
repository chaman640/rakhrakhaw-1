import { useCallback, useState } from 'react';

/**
 * `useState` jaisa hi — par is tab (session) me yaad rehta hai.
 *
 * Kyun: list page pe search/filter/page chuna, ek item khola, "back" dabaya —
 * aur sab kuch khali, pehle page pe, jaise pehli baar khola ho. Dukaandaar ko
 * phir se dhoondhna padta tha. Ab wapas aane par wahi filter, wahi page.
 *
 * sessionStorage isliye (localStorage nahi): tab band hote hi bhool jaye —
 * kal subah app khole to purane filter me atki hui list na mile. Storage band
 * ho (private mode) to bhi page chalta hai, bas yaad nahi rehta.
 */
export function useSessionState(key, initial) {
  const storageKey = `rr_ss:${key}`;
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  const set = useCallback((next) => {
    setValue((old) => {
      const v = typeof next === 'function' ? next(old) : next;
      try { sessionStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* private mode */ }
      return v;
    });
  }, [storageKey]);

  return [value, set];
}
