import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';

/**
 * Sidebar pe "Orders" ke saamne naye (PLACED) orders ka count.
 *
 * Buy mode me ye badge dikhta hi nahi (wo menu hi alag hai), isliye us waqt
 * poochhna bhi band kar dete hain — warna har 45 second me ek request bekaar
 * jati rehti, aur wo bhi galat duniya ka sawal poochh kar.
 */
export function useOrderBadge() {
  const { isWholesaler } = useAuth();
  const { buying } = useShop();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isWholesaler || buying) { setCount(0); return undefined; }

    let alive = true;
    const load = () => api.get('/orders/stats')
      .then((r) => { if (alive) setCount(r.data.counts?.PLACED || 0); })
      .catch(() => {});

    load();
    const id = setInterval(load, 45000);
    return () => { alive = false; clearInterval(id); };
  }, [isWholesaler, buying]);

  return count;
}
