import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

/* ─────────────────────── KIS DUKAAN SE KHAREED RAHE HAIN ───────────────────────

   Pehle ye sawal tha hi nahi — ek aadmi ek hi dukaan se juda tha, aur server
   token dekh kar khud jaan leta tha. Ab ek hi login se kai dukaanein judi ho
   sakti hain, isliye har request ke saath ye batana padta hai ki abhi kis
   dukaan ke andar hain.

   Header me kyun, har call me alag se kyun nahi:
   catalog, cart, my-orders, my-bills, my-khata — poore app me sau se zyada
   jagah `api.get(...)` likha hai. Har jagah ek naya parameter jodne ka matlab
   hota sau badlaav, aur jo ek jagah chhoot jati wo chup-chaap GALAT DUKAAN ka
   data dikhati — sabse khatarnak wali galti, kyunki dikhne me sab theek lagta.
   Ek jagah header laga dene se wo poora khatra hai hi nahi.

   localStorage me isliye ki page refresh karne pe dukaan badal na jaye.
   ───────────────────────────────────────────────────────────────────────────── */

const SHOP_KEY = 'rr_shop';

let activeShopId = null;
try { activeShopId = localStorage.getItem(SHOP_KEY) || null; } catch { /* private window */ }

/**
 * Header jayega ya nahi.
 *
 * Ye alag switch isliye hai ki chuni hui dukaan YAAD rehni chahiye, par SELLER
 * mode me uska header BHEJNA nahi chahiye.
 *
 * Bina iske ek bahut gandi galti hoti thi: wholesaler Buyer mode me ek dukaan
 * kholta, phir Seller pe wapas aata — aur uska apna dashboard us DOOSRI dukaan
 * ka jawab dikhane lagta, kyunki header abhi bhi ja raha tha. Dukaan ko yaad
 * rakhna aur header bhejna do alag baatein hain; ab dono ke do alag switch hain.
 */
let shopHeaderOn = false;

export function setShopHeaderEnabled(on) {
  shopHeaderOn = Boolean(on);
  return shopHeaderOn;
}

export function getActiveShopId() {
  return activeShopId;
}

/** `null` bhejne ka matlab: server khud tay kare (purane retailer wala rasta) */
export function setActiveShopId(id) {
  activeShopId = id || null;
  try {
    if (activeShopId) localStorage.setItem(SHOP_KEY, activeShopId);
    else localStorage.removeItem(SHOP_KEY);
  } catch { /* private window */ }
  return activeShopId;
}

// Har request pe token laga do
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  /*
    Ek request apni dukaan KHUD bhi bata sakti hai.

    Cart page pe teen dukaanon ka maal ek saath dikhta hai. Wahan quantity
    badalte waqt "abhi khuli hui dukaan" nahi, US LINE WALI dukaan chahiye —
    isliye wo call apna header khud bhejti hai.

    Ye jaanch (`pehle se hai?`) isi liye hai. Bina iske neeche wali line uspe
    chadh jati aur teeno dukaanon ki quantity CHUNI HUI dukaan me badalti rehti
    — sabse chup-chaap wala nuksaan, kyunki screen pe sab theek dikhta.
  */
  if (shopHeaderOn && activeShopId) {
    const already = typeof config.headers?.get === 'function'
      ? config.headers.get('X-Shop-Id')
      : config.headers?.['X-Shop-Id'];
    if (!already) config.headers['X-Shop-Id'] = activeShopId;
  }
  return config;
});

// Error ko ek jaisa banao — har page pe err.message seedha dikha sakein
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      'Kuch gadbad ho gayi, dobara koshish karein';

    if (status === 401) {
      localStorage.removeItem('rr_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject({
      status,
      message,
      details: error.response?.data?.details || null,
    });
  }
);

export default api;
