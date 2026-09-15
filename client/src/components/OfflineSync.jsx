import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { watchAndFlush } from '@/lib/offlineQueue';
import { useOnline } from '@/hooks/useOnline';
import { useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/*
  RUNNERS — jitne kaam abhi offline-safe maane gaye hain, unki poori list
  yahin ek jagah (Part 50). Naya kaam offline-safe banana ho to bas yahan ek
  line jodni hai — `enqueue('kind', payload)` jahan bhi chahiye, wahan se
  bulao.

  BILL BHI AB YAHAN HAI — safe kyun hai, `offlineQueue.js` ke upar likha hai.
*/
const RUNNERS = {
  expense: (payload) => api.post('/expenses', payload),
  invoice: (payload) => api.post('/invoices', payload),
};

/** Kahin dikhta nahi — sirf internet wapas aane ka intezaar karta hai */
export function OfflineSync() {
  const toast = useToast();

  useEffect(() => watchAndFlush(RUNNERS, (e) => {
    if (e.type === 'done') {
      bust('expenses', 'invoices', 'reports', 'dashboard', 'items', 'khata', 'parties', 'payments');
      const label = e.item.kind === 'invoice' ? t('Bill') : t('Kharch');
      toast.success(t('{a0} bhej diya — internet wapas aa gaya tha', { a0: label }));
    } else if (e.type === 'failed') {
      // Server ne dekh kar mana kiya (jaise stock kam hai) — insaan ko batana zaroori hai
      toast.error(t('Ek {a0} bhej nahi paya: {a1} — dekh kar theek karein', {
        a0: e.item.kind === 'invoice' ? t('bill') : t('Kharch'),
        a1: e.message || '',
      }));
    }
  }), []);

  return null;
}

/** Upar ek patli patti — jab tak internet nahi hai */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-1.5 bg-amber-500 px-3 py-1 text-xs font-medium text-white">
      <WifiOff size={13} />
      {t('Internet nahi hai — purana data dikha rahe hain')}
    </div>
  );
}
