import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext';
import { useShop } from './ShopContext';

const CartContext = createContext({ count: 0, shopCount: 0, refresh: () => {} });

/**
 * Neeche wali patti ke badge ke liye ginti. Poora cart Cart page khud laata hai.
 *
 * Do baatein Part 17 me badli hain:
 *
 * 1. Shart `isRetailer` thi — yaani wholesaler ka cart ho hi nahi sakta tha.
 *    Ab wo bhi khareedta hai, isliye shart `buying` hai.
 *
 * 2. Ginti ab SAB DUKAANON ki hai (`/buy/cart/count`), sirf khuli hui dukaan ki
 *    nahi. Wajah: badge poore cart ka hona chahiye. Pehle wale tarike me do
 *    dukaanon me maal pada hota aur badge sirf ek ka number dikhata — aadmi
 *    doosri dukaan ka maal bhool kar order bhej deta, aur wo cart me pada
 *    reh jata.
 */
export function CartProvider({ children }) {
  const { isRetailer, isApproved } = useAuth();
  const { buying } = useShop();
  const [count, setCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!buying || (isRetailer && !isApproved)) { setCount(0); setShopCount(0); return; }
    try {
      const res = await api.get('/buy/cart/count');
      setCount(res.data.count || 0);
      setShopCount(res.data.shopCount || 0);
    } catch {
      // Abhi approve nahi hua, ya koi dukaan judi hi nahi — badge dikhana galat hoga
      setCount(0);
      setShopCount(0);
    }
  }, [buying, isRetailer, isApproved]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <CartContext.Provider value={{ count, shopCount, refresh, setCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
