import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShoppingCart, TruckIcon, Wallet, TriangleAlert, X } from 'lucide-react';
import api from '@/lib/api';
import { useNotifications } from '@/context/NotificationContext';
import { formatDateTime } from '@/lib/format';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const ICONS = {
  NEW_ORDER: ShoppingCart,
  ORDER_STATUS: TruckIcon,
  PAYMENT_RECEIVED: Wallet,
  LOW_STOCK: TriangleAlert,
  PAYMENT_REMINDER: Wallet,
};

export default function NotificationBell() {
  const { count, refresh, setCount } = useNotifications();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { limit: 15 } });
      setRows(res.data);
    } catch { /* chup-chaap */ }
    finally { setLoading(false); }
  }, []);

  /*
    DARAZ KHOLTE HI SAB "PADH LIYA".

    Pehle laal ginti tabhi hatti thi jab har notification pe alag alag click
    karo, ya "Sab padh liya" dhoondh kar dabao. Nateeja: ginti hamesha lagi
    rehti thi, aur jo cheez hamesha laal rehti hai uspe aankh jana band kar
    deti hai — yani asli zaroori khabar bhi dikhna band ho jati.

    Daraz khol lena hi "dekh liya" hai. Poora padhna alag baat hai, aur uske
    liye har line apni jagah khuli padi hai.
  */
  useEffect(() => {
    if (!open) return;
    load();
    if (count > 0) {
      api.post('/notifications/read-all')
        .then(() => { setCount(0); setRows((rs) => rs.map((r) => ({ ...r, isRead: true }))); })
        .catch(() => { /* chup-chaap — khabar dikhna zaroori hai, ginti nahi */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.isRead) {
      try {
        const res = await api.post(`/notifications/${n._id}/read`);
        setCount(res.data.count);
      } catch { /* chup-chaap */ }
    }
    if (n.link) navigate(n.link);
  }


  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); refresh(); }}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-ring"
        aria-label={count > 0 ? `${count} nayi notification` : 'Notifications'}
      >
        <Bell size={19} />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* Phone pe screen se bahar na nikle — wahan poori width, desktop pe bell ke neeche */}
          <div className="fixed inset-x-2 top-16 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{t('Notifications')}</p>
              {/*
                Band karne ka button — phone pe ye sabse zaroori hai.

                Daraz poori screen ghere hue hai; band karne ka ek hi rasta tha
                uske BAHAR kahin tap karna. Wo desktop pe saaf hai, phone pe
                nahi — bahar bacha hi kitna hai. Log back button dabate the aur
                poore page se hi bahar chale jate the.
              */}
              <button onClick={() => setOpen(false)}
                aria-label={t('Band karein')}
                className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-ring">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8 text-slate-400"><Spinner size={20} /></div>
              ) : !rows.length ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  {t('Abhi koi notification nahi')}
                </p>
              ) : (
                rows.map((n) => {
                  const Icon = ICONS[n.type] || Bell;
                  return (
                    <button
                      key={n._id}
                      onClick={() => openItem(n)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0',
                        n.isRead ? 'hover:bg-slate-50' : 'bg-brand-50/60 hover:bg-brand-50'
                      )}
                    >
                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        n.isRead ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-700')}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm', n.isRead ? 'text-slate-700' : 'font-medium text-slate-900')}>
                          {n.title}
                        </p>
                        {n.body && <p className="truncate text-xs text-slate-500">{n.body}</p>}
                        <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full border-t border-slate-200 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-slate-50"
            >
              {t('Saari notifications dekhein')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
