import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import api, { getActiveShopId, setActiveShopId, setShopHeaderEnabled } from '@/lib/api';
import { clearCache } from '@/lib/queryCache';
import { useAuth } from './AuthContext';

/**
 * DO DARWAZE — BECHNA aur KHAREEDNA.
 *
 * Ek hi wholesaler account ke ab do roop hain:
 *
 *   SELLER — aaj jaisa hai bilkul waisa. Bill, order, stock, khata, staff.
 *   BUYER  — wahi screen jo retailer ko dikhti hai. Doosri dukaan se maal
 *            mangwane ke liye.
 *
 * Toggle Profile page pe hai. Yahan sirf do cheezein sambhali jati hain:
 *
 *   1. `mode`   — abhi kaunsa darwaza khula hai
 *   2. `shopId` — buy mode me KIS dukaan ke andar hain
 *
 * Retailer ke liye mode ka sawal hi nahi — uska poora kaam khareedna hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUKAAN BADALTE HI CACHE POORA SAAF.
 *
 * `useQuery` ki chaabiyon me dukaan ka naam nahi hai (`['catalog', {...}]`).
 * Iska matlab: dukaan badalne par purani dukaan ka catalog aur cart ek pal ke
 * liye NAYI dukaan ke naam ke neeche dikh jate. Rate doosri dukaan ke, stock
 * doosri dukaan ka — aur aadmi usi bharose pe order kar deta.
 *
 * Har chaabi me shopId jodna sau jagah ka badlaav hota, aur jo ek jagah chhoot
 * jati wahi ye galti karti rehti. Poora cache saaf kar dena ek hi jagah ka
 * kaam hai aur usme kuch chhoot hi nahi sakta. Dukaan din me do-chaar baar hi
 * badalti hai, isliye ek baar dobara data laane ka mol chukana sasta hai.
 * ─────────────────────────────────────────────────────────────────────────
 */

const ShopContext = createContext(null);

const MODE_KEY = 'rr_mode';
const SELL = 'sell';
const BUY = 'buy';

function readMode() {
  try { return localStorage.getItem(MODE_KEY) === BUY ? BUY : SELL; } catch { return SELL; }
}

export function ShopProvider({ children }) {
  const { user, isRetailer, isApproved, loading: authLoading } = useAuth();

  // Wholesaler khareed sakta hai ya nahi — server ka hi faisla (`canBuy`)
  const canBuy = Boolean(user && (isRetailer || user.canBuy));

  const [mode, setModeState] = useState(readMode);
  const [shopId, setShopIdState] = useState(() => getActiveShopId());
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // Buy mode me hain ya nahi — retailer hamesha, wholesaler jab toggle kare
  const buying = Boolean(user) && (isRetailer || (mode === BUY && canBuy));

  /*
    Header ka switch RENDER ke waqt hi lagta hai, `useEffect` me nahi.

    Effect bachchon ke render ke BAAD chalta hai. Iska matlab hota ki pehle
    render pe jo request nikli (aur nikalti hai — har page mount hote hi data
    maangta hai) wo bina header ke chali jati, yaani GALAT DUKAAN se jawab laati.
    Ek pal ka farak, par us pal me screen pe doosri dukaan ka maal hota hai.

    Ye function React ki state nahi chhedta — sirf ek module ka switch hai —
    isliye yahan bulana surakshit hai aur do baar chal jane se bhi kuch nahi
    bigadta.
  */
  setShopHeaderEnabled(buying);

  /* ---- save ki hui dukaanein ---- */
  const refreshShops = useCallback(async () => {
    if (!user || !canBuy || (isRetailer && !isApproved)) { setShops([]); return []; }
    setLoadingShops(true);
    try {
      const res = await api.get('/shops/saved');
      const list = res.data || [];
      setShops(list);
      return list;
    } catch {
      return [];               // chup-chaap — search page khud error dikhayega
    } finally {
      setLoadingShops(false);
    }
  }, [user, canBuy, isRetailer, isApproved]);

  useEffect(() => {
    if (authLoading) return;
    refreshShops();
  }, [authLoading, refreshShops]);

  /* ---- dukaan chunna ---- */
  const selectShop = useCallback((id) => {
    const next = id || null;
    if (String(next || '') === String(getActiveShopId() || '')) {
      setShopIdState(next);
      return;
    }
    setActiveShopId(next);
    setShopIdState(next);
    clearCache();              // upar wali wajah — purani dukaan ka data mat dikhao
    if (next) api.post(`/shops/${next}/touch`).catch(() => {});
  }, []);

  /* ---- darwaza badalna ---- */
  const setMode = useCallback((next) => {
    const value = next === BUY ? BUY : SELL;
    setModeState(value);
    try { localStorage.setItem(MODE_KEY, value); } catch { /* private window */ }
    // Bechne wale ka data aur khareedne wale ka data ek jaisi chaabiyon pe
    // baithte hain (jaise `orders`) — isliye darwaza badalte hi cache saaf
    clearCache();
  }, []);

  /*
    Wholesaler ne buy mode chala rakha tha, phir uski ijazat chali gayi
    (malik ne `purchases:create` hata diya). Use buy mode me chhod dena galat
    hai — har page pe "ijazat nahi" aata rahega aur wajah kahin dikhegi nahi.
  */
  useEffect(() => {
    if (!authLoading && user && !canBuy && mode === BUY) setMode(SELL);
  }, [authLoading, user, canBuy, mode, setMode]);

  /*
    Chuni hui dukaan ab list me hai hi nahi (jud gaye the, phir hata diya, ya
    doosre login se aaye hain). Tab chunaav ko pakde rehna galat data dikhata
    hai — chhod do, server apne aap purani wali dukaan chun lega.
  */
  useEffect(() => {
    if (!shopId || loadingShops || !shops.length) return;
    if (!shops.some((s) => String(s._id) === String(shopId))) selectShop(null);
  }, [shopId, shops, loadingShops, selectShop]);

  const shop = useMemo(
    () => shops.find((s) => String(s._id) === String(shopId)) || null,
    [shops, shopId],
  );

  /**
   * KHABAR PE TAP — pehle sahi dukaan me pahuncho, phir wo page kholo.
   *
   * "Bada Traders ne aapka order pack kar diya" pe tap karne se `/my-orders/123`
   * khulta hai. Par agar us waqt koi aur dukaan khuli ho, to wo order us dukaan
   * me hai hi nahi — screen pe "Order nahi mila" aa jata hai. Khabar sahi thi,
   * page sahi tha, bas aadmi galat dukaan me khada tha.
   *
   * Har khabar apne saath `businessId` le kar aati hai (Notification model me
   * pehle se hai), isliye kholne se pehle chup-chaap usi dukaan me le jate hain.
   * Sirf tabhi jab wo dukaan sach me judi ho — warna kuch nahi badalte.
   */
  const enterShopForLink = useCallback((link, businessId) => {
    if (!buying || !link) return;
    const path = String(link);

    /*
      Bechne wale wale page ki khabar — pehle darwaza badlo.

      "Bada Traders ka maal aa gaya — stock me daal lijiye" `/stock-intake` pe
      le jata hai, aur wo APNI dukaan ka kaam hai. Buy mode me us page pe
      pahunchne se neeche kharidne wala menu dikhta rehta hai aur aadmi ko samajh
      hi nahi aata ki wo kis duniya me khada hai.
    */
    const sellSide = ['/stock-intake', '/orders', '/invoices', '/purchases', '/items',
      '/khata', '/payments', '/returns', '/staff', '/reports', '/dashboard', '/expenses',
      '/suppliers', '/retailers', '/sales']
      .some((prefix) => path.startsWith(prefix));
    if (sellSide) { setMode(SELL); return; }

    if (!businessId) return;
    const buySide = ['/my-orders', '/my-bills', '/my-khata', '/shop', '/cart']
      .some((prefix) => path.startsWith(prefix));
    if (!buySide) return;
    if (!shops.some((s) => String(s._id) === String(businessId))) return;
    selectShop(businessId);
  }, [buying, shops, selectShop, setMode]);

  const value = useMemo(() => ({
    mode, setMode,
    buying, canBuy,
    isBuyMode: buying && !isRetailer,   // wholesaler ka buy mode (banner ke liye)
    shopId, shop, shops, loadingShops,
    selectShop, refreshShops, enterShopForLink,
  }), [mode, setMode, buying, canBuy, isRetailer, shopId, shop, shops, loadingShops,
    selectShop, refreshShops, enterShopForLink]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop ko ShopProvider ke andar hi use karein');
  return ctx;
}
