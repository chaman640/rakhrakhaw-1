import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ShoppingCart, TruckIcon, Wallet, TriangleAlert, CheckCheck,
  Trash2, BellOff, X, PackagePlus,
} from 'lucide-react';
import api from '@/lib/api';
import { useNotifications } from '@/context/NotificationContext';
import { useShop } from '@/context/ShopContext';
import { formatDateTime } from '@/lib/format';
import {
  PageHeader, Card, Button, Chips, Pagination, EmptyState, Spinner, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const TYPES = [
  { value: 'all', label: 'Sab' },
  { value: 'NEW_ORDER', label: 'Naye order' },
  { value: 'ORDER_STATUS', label: 'Order update' },
  { value: 'PAYMENT_RECEIVED', label: 'Payment' },
  { value: 'PAYMENT_REMINDER', label: 'Yaad dilana' },
  { value: 'LOW_STOCK', label: 'Stock' },
  { value: 'STOCK_INTAKE', label: 'Maal aaya' },
];

const ICONS = {
  NEW_ORDER: ShoppingCart,
  ORDER_STATUS: TruckIcon,
  PAYMENT_RECEIVED: Wallet,
  PAYMENT_REMINDER: Wallet,
  LOW_STOCK: TriangleAlert,
  STOCK_INTAKE: PackagePlus,
};

const TONE = {
  NEW_ORDER: 'bg-blue-50 text-blue-700',
  ORDER_STATUS: 'bg-brand-50 text-brand-700',
  PAYMENT_RECEIVED: 'bg-emerald-50 text-emerald-700',
  PAYMENT_REMINDER: 'bg-amber-50 text-amber-700',
  LOW_STOCK: 'bg-red-50 text-red-700',
  STOCK_INTAKE: 'bg-amber-50 text-amber-700',
};

/** Aaj / Kal / uske pehle — date se zyada ye samajh aata hai */
function bucketOf(date) {
  const d = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d >= today) return 'Aaj';
  if (d >= yesterday) return 'Kal';
  return 'Usse pehle';
}

export default function Notifications() {
  const toast = useToast();
  const navigate = useNavigate();
  const { setCount, refresh } = useNotifications();
  // Khabar us dukaan me le jati hai jiski wo hai (ShopContext me poori wajah)
  const { enterShopForLink } = useShop();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 30, total: 0, totalPages: 1 });
  const [counts, setCounts] = useState({ all: 0, unread: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', {
        params: { type, onlyUnread: String(onlyUnread), page, limit: 30 },
      });
      setRows(res.data);
      setMeta(res.meta);
      setCount(res.unread ?? 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, onlyUnread, page]);

  const loadCounts = useCallback(() => {
    api.get('/notifications/counts').then((r) => setCounts(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setPage(1); }, [type, onlyUnread]);

  async function open(n) {
    if (!n.isRead) {
      try {
        const res = await api.post(`/notifications/${n._id}/read`);
        setCount(res.data.count);
        setRows((rs) => rs.map((r) => (r._id === n._id ? { ...r, isRead: true } : r)));
        loadCounts();
      } catch { /* chup-chaap */ }
    }
    if (n.link) {
      enterShopForLink(n.link, n.businessId);
      navigate(n.link);
    }
  }

  async function readAll() {
    setBusy(true);
    try {
      const res = await api.post('/notifications/read-all');
      toast.success(res.message);
      setCount(0);
      load(); loadCounts();
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  async function removeOne(e, n) {
    e.stopPropagation();
    try {
      const res = await api.delete(`/notifications/${n._id}`);
      setCount(res.data.count);
      setRows((rs) => rs.filter((r) => r._id !== n._id));
      loadCounts();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function clearRead() {
    setBusy(true);
    try {
      const res = await api.delete('/notifications/clear-read');
      toast.success(res.message);
      load(); loadCounts(); refresh();
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  // Bucket ke hisaab se heading dikhane ke liye
  let lastBucket = null;

  return (
    <>
      <PageHeader
        title={t('Notifications')}
        subtitle={counts.unread > 0 ? `${counts.unread} abhi tak padhi nahi` : 'Sab padh liya'}
        action={
          <>
            {counts.unread > 0 && (
              <Button variant="secondary" icon={CheckCheck} loading={busy} onClick={readAll}>
                {t('Sab padh liya')}
              </Button>
            )}
            {counts.all > counts.unread && (
              <Button variant="ghost" icon={Trash2} loading={busy} onClick={clearRead}>
                {t('Purani hatayein')}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Chips value={type} onChange={setType}
            options={TYPES.map((ty) => ({
              ...ty,
              label: counts.byType?.[ty.value]?.unread
                ? `${t(ty.label)} (${counts.byType[ty.value].unread})`
                : t(ty.label),
            }))} />
          <button
            onClick={() => setOnlyUnread((v) => !v)}
            aria-pressed={onlyUnread}
            className={cn(
              'ml-auto rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-ring',
              onlyUnread
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            {t('Sirf nayi')}
          </button>
        </div>
      </Card>

      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400"><Spinner size={24} /></div>
        ) : !rows.length ? (
          <EmptyState
            icon={BellOff}
            title={onlyUnread ? 'Sab padh liya' : 'Abhi koi notification nahi'}
            message={onlyUnread
              ? 'Koi nayi notification nahi bachi.'
              : 'Naya order aaye, payment mile ya stock kam ho — yahan alert aa jayega.'}
          />
        ) : (
          <>
            {rows.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              const bucket = bucketOf(n.createdAt);
              const showHead = bucket !== lastBucket;
              lastBucket = bucket;

              return (
                <div key={n._id}>
                  {showHead && (
                    <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {bucket}
                    </p>
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => open(n)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(n); } }}
                    className={cn(
                      'group flex w-full cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left last:border-0 focus-ring',
                      n.isRead ? 'hover:bg-slate-50' : 'bg-brand-50/50 hover:bg-brand-50'
                    )}
                  >
                    <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      n.isRead ? 'bg-slate-100 text-slate-400' : TONE[n.type] || 'bg-brand-100 text-brand-700')}>
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', n.isRead ? 'text-slate-700' : 'font-medium text-slate-900')}>
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                    </div>

                    {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}

                    <button
                      onClick={(e) => removeOne(e, n)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 focus-ring group-hover:opacity-100"
                      aria-label={t('Ye notification hatayein')}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
