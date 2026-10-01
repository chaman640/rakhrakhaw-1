import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { watchAndFlush, flush, listQueue, listFailed, retryFailed, dismissFailed, onQueueChange } from '@/lib/offlineQueue';
import { refreshOfflineData } from '@/lib/offlineData';
import { useAuth } from '@/context/AuthContext';
import { Modal, Button } from '@/components/ui';
import { formatMoney } from '@/lib/format';
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
const withKey = (key) => ({ headers: { 'Idempotency-Key': key } });
export const RUNNERS = {
  expense: (payload, key) => api.post('/expenses', payload, withKey(key)),
  invoice: (payload, key) => api.post('/invoices', payload, withKey(key)),
  payment: (payload, key) => api.post('/payments', payload, withKey(key)),
  purchase: (payload, key) => api.post('/purchases', payload, withKey(key)),
};

export const KIND_LABEL = { invoice: 'Bill', expense: 'Kharch', payment: 'Payment', purchase: 'Purchase' };

/** Kahin dikhta nahi — sirf internet wapas aane ka intezaar karta hai */
export function OfflineSync() {
  const toast = useToast();
  const { user, isWholesaler } = useAuth();
  const seller = Boolean(user && isWholesaler && !user.mustChangePassword);

  // Keep the on-phone copy of items and parties fresh while online
  useEffect(() => {
    if (!seller) return undefined;
    const refresh = () => refreshOfflineData(api);
    refresh();
    window.addEventListener('online', refresh);
    const id = setInterval(refresh, 15 * 60000);
    return () => { window.removeEventListener('online', refresh); clearInterval(id); };
  }, [seller, user?._id]);

  useEffect(() => watchAndFlush(RUNNERS, (e) => {
    const label = t(KIND_LABEL[e.item?.kind] || 'Entry');
    if (e.type === 'done') {
      bust('expenses', 'invoices', 'reports', 'dashboard', 'items', 'khata', 'parties', 'payments', 'purchases');
      refreshOfflineData(api);
      toast.success(t('{a0} bhej diya — internet wapas aa gaya tha', { a0: label }));
    } else if (e.type === 'failed') {
      // Server ne dekh kar mana kiya (jaise stock kam hai) — insaan ko batana zaroori hai
      toast.error(t('Ek {a0} bhej nahi paya: {a1} — dekh kar theek karein', { a0: label, a1: e.message || '' }));
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

function describe(item) {
  const p = item.payload || {};
  const amount = p.amount ?? p.paidAmount;
  const lines = Array.isArray(p.items) ? t('{n} item', { n: p.items.length }) : '';
  return [lines, amount ? formatMoney(amount) : '', new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })]
    .filter(Boolean).join(' · ');
}

/** "3 entries waiting to sync" — tap to see them, retry or remove ones the server refused */
export function SyncBar() {
  const toast = useToast();
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [failed, setFailed] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (typeof indexedDB === 'undefined') return;
    Promise.all([listQueue(), listFailed()]).then(([p, f]) => { setPending(p); setFailed(f); }).catch(() => {});
  }, []);

  useEffect(() => { load(); return onQueueChange(load); }, [load, user?._id]);

  if (!user || (!pending.length && !failed.length)) return null;

  async function syncNow() {
    setBusy(true);
    try { await flush(RUNNERS); } finally { setBusy(false); load(); }
    if (navigator.onLine === false) toast.info(t('Internet nahi hai — net aate hi apne aap bhej denge'));
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`sticky top-0 z-40 flex w-full items-center justify-center gap-1.5 px-3 py-1 text-xs font-medium text-white ${failed.length ? 'bg-red-600' : 'bg-slate-700'}`}>
        {failed.length ? <AlertTriangle size={13} /> : <RefreshCw size={13} />}
        {failed.length
          ? t('{n} entry bhej nahi paye — dekhein', { n: failed.length })
          : t('{n} entry bhejni baaki — net aate hi chali jayengi', { n: pending.length })}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Bina internet ki entries')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('Band karein')}</Button><Button icon={RefreshCw} loading={busy} onClick={syncNow}>{t('Abhi bhejein')}</Button></>}>
        {failed.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-red-700">{t('Server ne mana kiya — dekh kar theek karein')}</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-red-200">
              {failed.map((f) => (
                <li key={f.id} className="p-3 text-sm">
                  <p className="font-medium text-slate-900">{t(KIND_LABEL[f.kind] || 'Entry')} <span className="font-normal text-slate-500">· {describe(f)}</span></p>
                  <p className="mt-0.5 text-xs text-red-700">{f.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={async () => { await retryFailed(f.id); syncNow(); }}>{t('Dobara bhejein')}</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => dismissFailed(f.id)}>{t('Hatayein')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pending.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">{t('Bhejni baaki')}</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {pending.map((p) => (
                <li key={p.id} className="p-3 text-sm">
                  <p className="font-medium text-slate-900">{t(KIND_LABEL[p.kind] || 'Entry')} <span className="font-normal text-slate-500">· {describe(p)}</span></p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">{t('Ye phone me surakshit hain. Bill ka number aur stock ki jaanch bhejte waqt hoti hai.')}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
