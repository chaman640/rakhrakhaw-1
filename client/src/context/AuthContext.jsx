import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import api, { setActiveShopId } from '@/lib/api';
import { clearCache } from '@/lib/queryCache';

const AuthContext = createContext(null);
const TOKEN_KEY = 'rr_token';
const SESSION_KEY = 'rr_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [party, setParty] = useState(null);      // sirf retailer ke liye
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    setUser(data?.user || null);
    setBusiness(data?.business || null);
    setParty(data?.party || null);
    // Last good session, tied to this exact login, so the app still opens without internet
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (data?.user && token) localStorage.setItem(SESSION_KEY, JSON.stringify({ t: token.slice(-32), data: { user: data.user, business: data.business, party: data.party } }));
      else if (!data) localStorage.removeItem(SESSION_KEY);
    } catch { /* storage full or blocked */ }
  }, []);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      applySession(res.data);
    } catch (err) {
      // No answer at all (offline) — keep the login and use the saved session for this token
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { /* broken */ }
      if (typeof err?.status !== 'number' && saved?.t === token.slice(-32) && saved.data?.user) {
        applySession(saved.data);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        applySession(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => { loadSession(); }, [loadSession]);
  const userRef = useRef(null);
  userRef.current = user;
  useEffect(() => {
    // Only when the server says so and we don't already know (avoids a refetch loop from background polling)
    const on = () => { if (userRef.current && !userRef.current.mustChangePassword) loadSession(); };
    window.addEventListener('rr:must-change-password', on);
    return () => window.removeEventListener('rr:must-change-password', on);
  }, [loadSession]);

  /** Wholesaler / retailer dono ke liye */
  const login = useCallback(async (phone, password, extra = null) => {
    const res = await api.post('/auth/login', extra ? { ...extra, password } : { phone, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    // Naya aadmi, nayi shuruaat — pichhle wale ki chuni hui dukaan yahin chhod do
    setActiveShopId(null);
    clearCache();
    applySession(res.data);
    return res.data;
  }, [applySession]);

  const signupWholesaler = useCallback(async (payload) => {
    const res = await api.post('/auth/wholesaler/signup', payload);
    localStorage.setItem(TOKEN_KEY, res.data.token);
    applySession({ user: res.data.user, business: res.data.business, party: null });
    return res.data;
  }, [applySession]);

  const signupRetailer = useCallback(async (payload) => {
    const res = await api.post('/auth/retailer/signup', payload);
    localStorage.setItem(TOKEN_KEY, res.data.token);
    applySession(res.data);
    return res.data;
  }, [applySession]);

  /**
   * Staff invite link se judna.
   *
   * Account bante hi login bhi ho jata hai — warna naya aadmi account banata,
   * phir login page pe jata, phir wahi phone aur password dobara likhta.
   */
  const joinAsStaff = useCallback(async (token, payload) => {
    const res = await api.post(`/staff/invites/${token}/accept`, payload);
    localStorage.setItem(TOKEN_KEY, res.data.token);
    applySession(res.data);
    return res.data;
  }, [applySession]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* token expire ho chuka hoga */ }
    localStorage.removeItem(TOKEN_KEY);
    // Chuni hui dukaan bhi bhool jao — warna agla aadmi jo isi phone pe login
    // karega uski har request PICHHLE wale ki dukaan ka header le kar jayegi,
    // aur server 403 dekar use har page se bahar kar dega. Dikhta ye hai ki
    // "app kharab ho gaya", jabki bas ek purana header pada reh gaya tha.
    setActiveShopId(null);
    // Cache bhi khali karo — warna usi computer pe agla aadmi login karega
    // aur ek pal ke liye PICHHLE wale ka data dekh lega (cache turant dikhata
    // hai, chahe wo kisi aur ka ho). Ye chhoti si line hi wo rok hai.
    clearCache();
    applySession(null);
  }, [applySession]);

  const value = {
    user, business, party, loading,
    setBusiness,
    login, logout, signupWholesaler, signupRetailer, joinAsStaff,
    refresh: loadSession,
    passwordChanged: () => setUser((u) => (u ? { ...u, mustChangePassword: false } : u)),
    isWholesaler: user?.role === 'wholesaler',
    isRetailer: user?.role === 'retailer',
    // Maal khareed sakta hai ya nahi — server ka faisla (`purchases:create`).
    // Isi se Profile pe Buyer wala button dikhta hai.
    canBuy: Boolean(user?.canBuy),
    // Retailer approve hua ya nahi
    // Koi party hi nahi (naya standalone retailer, abhi kisi dukaan se juda
    // nahi) — ye "approval baaki" nahi hai, bas abhi tak koi dukaan chuni
    // nahi. Approval ka intezaar waise bhi ab kahin lagta hi nahi (server
    // hamesha ACTIVE deta hai) — party hoga to status 'active' hi hoga.
    isApproved: user?.role !== 'retailer' || !party || party?.status === 'active',
    partyStatus: party?.status || null,
    // GST on/off — poori app isi flag se tax fields dikhati/chhupati hai
    gstEnabled: Boolean(business?.gstEnabled),

    /* ──────────────── Staff, ijazat aur hadd ────────────────
     *
     * Yahan jo bhi chhupta hai wo sirf DIKHAWE ke liye hai. Asli rok server
     * pe lagti hai — har request pe. Client pe button chhupana suraksha nahi
     * hoti, wo bas user ko wo cheez nahi dikhati jo wo kar nahi sakta.
     */
    isOwner: Boolean(user?.isOwner),
    staffRole: user?.staffRole || null,
    staffRoleLabel: user?.staffRoleLabel || '',
    permissions: user?.permissions || [],

    /**
     * `can('invoices:create')` — ek khaas kaam ki ijazat.
     *
     * Bina `:` ke naam bhi chalta hai (`can('invoices')`), tab matlab hota
     * hai "is module me kuch bhi kar sakta hai?" — menu dikhane ke liye wahi
     * chahiye hota hai.
     */
    can: function can(permission) {
      if (Array.isArray(permission)) return permission.some((p) => can(p));
      if (user?.isOwner) return true;
      const list = user?.permissions || [];
      if (!permission) return false;
      if (String(permission).includes(':')) return list.includes(permission);
      return list.some((p) => p.startsWith(`${permission}:`));
    },

    // "Sirf apna kaam" wala hai kya
    isScoped: user?.scope === 'own' && !user?.isOwner,

    // Paise ki hadd — form pehle hi bata deta hai, save karne ke baad nahi
    limits: user?.limits || { maxDiscountPercent: null, maxInvoiceAmount: null, canSellOnCredit: true },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ko AuthProvider ke andar hi use karein');
  return ctx;
}
