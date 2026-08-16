import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'rr_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [party, setParty] = useState(null);      // sirf retailer ke liye
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    setUser(data?.user || null);
    setBusiness(data?.business || null);
    setParty(data?.party || null);
  }, []);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      applySession(res.data);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      applySession(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => { loadSession(); }, [loadSession]);

  /** Wholesaler / retailer dono ke liye */
  const login = useCallback(async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
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
    applySession(null);
  }, [applySession]);

  const value = {
    user, business, party, loading,
    setBusiness,
    login, logout, signupWholesaler, signupRetailer, joinAsStaff,
    refresh: loadSession,
    isWholesaler: user?.role === 'wholesaler',
    isRetailer: user?.role === 'retailer',
    // Retailer approve hua ya nahi
    isApproved: user?.role !== 'retailer' || party?.status === 'active',
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
    can: (permission) => {
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
