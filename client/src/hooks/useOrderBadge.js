import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/** Sidebar pe "Orders" ke saamne naye (PLACED) orders ka count */
export function useOrderBadge() {
  const { isWholesaler } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isWholesaler) { setCount(0); return undefined; }

    let alive = true;
    const load = () => api.get('/orders/stats')
      .then((r) => { if (alive) setCount(r.data.counts?.PLACED || 0); })
      .catch(() => {});

    load();
    const id = setInterval(load, 45000);
    return () => { alive = false; clearInterval(id); };
  }, [isWholesaler]);

  return count;
}
