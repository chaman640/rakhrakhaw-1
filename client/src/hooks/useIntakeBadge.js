import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';

/**
 * Menu me "Maal stock me" ke saamne kitne kaam baaki hain.
 *
 * Ye ginti khabar nahi, KAAM batati hai — jab tak ye zero nahi hota, us maal ka
 * stock app me hai hi nahi. Isliye ye badge chhupana nahi chahiye; jitni der ye
 * dikhta rahega utni der aadmi ko yaad rahega.
 *
 * Buy mode me band — wahan ye menu dikhta hi nahi, aur har 60 second me ek
 * bekaar request bhejna sirf net aur battery kharch karta hai.
 */
export function useIntakeBadge() {
  const { isWholesaler, can } = useAuth();
  const { buying } = useShop();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isWholesaler || buying || !can('purchases:view')) { setCount(0); return undefined; }

    let alive = true;
    const load = () => api.get('/stock-intake/count')
      .then((r) => { if (alive) setCount(r.data.count || 0); })
      .catch(() => {});

    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWholesaler, buying]);

  return count;
}
