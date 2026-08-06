import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext({ count: 0, refresh: () => {} });

/** Sirf cart ka count — sidebar ke badge ke liye. Poora cart Cart page khud laata hai. */
export function CartProvider({ children }) {
  const { isRetailer, isApproved } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isRetailer || !isApproved) { setCount(0); return; }
    try {
      const res = await api.get('/cart/count');
      setCount(res.data.count || 0);
    } catch { /* chup-chaap */ }
  }, [isRetailer, isApproved]);

  useEffect(() => { refresh(); }, [refresh]);

  return <CartContext.Provider value={{ count, refresh, setCount }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
