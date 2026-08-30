import axios from 'axios';

/*
  SALESMAN KA APNA API — dukaan wale `lib/api.js` se BILKUL ALAG.

  Wo wala har request me dukaan ka token aur `X-Shop-Id` bhejta hai. Salesman
  koi dukaan ka aadmi hai hi nahi; uska token bhi alag hai (aud: partner).
  Dono ko ek hi jagah se chalane ka matlab hota ki ek din ek token doosri jagah
  chala jaye — aur wo galti paise wale system me sabse mehngi hai.

  Token bhi alag chaabi pe rakha jata hai, taaki dukaan se logout hone pe
  salesman ka login na toote (aur ulta bhi).
*/

const KEY = 'rr_partner_token';
const ADMIN_KEY = 'rr_partner_admin_token';

export const getToken = (admin = false) => {
  try { return localStorage.getItem(admin ? ADMIN_KEY : KEY) || ''; } catch { return ''; }
};

export const setToken = (token, admin = false) => {
  try {
    if (token) localStorage.setItem(admin ? ADMIN_KEY : KEY, token);
    else localStorage.removeItem(admin ? ADMIN_KEY : KEY);
  } catch { /* private window */ }
};

const client = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api') + '/partner',
});

client.interceptors.request.use((cfg) => {
  const admin = String(cfg.url || '').startsWith('/admin');
  const token = getToken(admin);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const d = err.response?.data;
    const e = new Error(d?.message || 'Kuch gadbad ho gayi — dobara koshish karein');
    e.status = err.response?.status;
    e.fields = d?.errors || null;
    return Promise.reject(e);
  },
);

export default client;
