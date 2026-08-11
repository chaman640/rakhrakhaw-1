import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Clock, IndianRupee, Calendar, ChevronRight, TriangleAlert,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatDateTime, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Table, Badge, SearchInput, Chips,
  Select, Input, Pagination, EmptyState, useToast,
} from '@/components/ui';

export const STATUS_TONE = {
  PLACED: 'blue', PACKED: 'amber', READY: 'brand', DELIVERED: 'green', CANCELLED: 'red',
};
export const STATUS_LABEL = {
  PLACED: 'Naya', PACKED: 'Pack ho raha', READY: 'Tayyar', DELIVERED: 'De diya', CANCELLED: 'Cancel',
};

export default function Orders() {
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ counts: {}, open: 0, openAmount: 0, todayCount: 0, todayAmount: 0 });
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [status, setStatus] = useState('open');
  const [partyId, setPartyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const loadStats = useCallback(async () => {
    try { setStats((await api.get('/orders/stats')).data); } catch { /* chup-chaap */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders', {
        params: { q: debouncedQ, status, partyId, from: from || undefined, to: to || undefined, page, limit: 25 },
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, partyId, from, to, page]);

  useEffect(() => {
    loadStats();
    api.get('/parties', { params: { type: 'retailer', limit: 200 } })
      .then((r) => setRetailers(r.data)).catch(() => {});
    const id = setInterval(loadStats, 45000);
    return () => clearInterval(id);
  }, [loadStats]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, status, partyId, from, to]);

  const columns = [
    {
      key: 'orderNo',
      header: 'Order',
      render: (r) => (
        <button onClick={() => navigate(`/orders/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.orderNo}</p>
          <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
        </button>
      ),
    },
    {
      key: 'party',
      header: 'Retailer',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.party?.name || '—'}</p>
          <p className="text-xs text-slate-500">{r.party?.phone}</p>
        </div>
      ),
    },
    { key: 'itemCount', header: 'Items', align: 'right', render: (r) => r.itemCount },
    { key: 'itemsTotal', header: 'Kul', align: 'right', render: (r) => formatMoney(r.itemsTotal) },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/orders/${r._id}`)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Kholein">
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  const c = stats.counts || {};

  return (
    <>
      <PageHeader title="Orders" subtitle="Retailers ke bheje hue order" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Naye order" value={c.PLACED || 0} icon={ShoppingCart}
          tone={c.PLACED ? 'amber' : 'brand'} sub="jinpe kaam shuru nahi hua" />
        <StatCard label="Chal rahe hain" value={stats.open} icon={Clock} tone="brand"
          sub={formatMoney(stats.openAmount)} />
        <StatCard label="Aaj ke order" value={stats.todayCount} icon={Calendar} tone="green"
          sub={formatMoney(stats.todayAmount)} />
        <StatCard label="De diye" value={c.DELIVERED || 0} icon={IndianRupee} tone="green" />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Order number ya retailer..."
            className="w-full sm:w-56" />
          <Chips value={status} onChange={setStatus}
            options={[
              { value: 'open', label: 'Chalu', count: stats.open },
              { value: 'PLACED', label: 'Naye', count: c.PLACED },
              { value: 'PACKED', label: 'Pack ho rahe', count: c.PACKED },
              { value: 'READY', label: 'Tayyar', count: c.READY },
              { value: 'DELIVERED', label: 'De diye' },
              { value: 'all', label: 'Sab' },
            ]} />
          <div className="w-44">
            <Select placeholder="Sab retailers" value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              options={retailers.map((r) => ({ value: r._id, label: r.shopName || r.name }))} />
          </div>
          <div className="w-36"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-36"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={ShoppingCart}
            title={status === 'open' ? 'Koi chalu order nahi' : 'Is filter me koi order nahi'}
            message="Retailers apne app se order bhejenge to yahan turant dikh jayenge — aur bell bhi bajegi."
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
                : rows.map((r) => (
                  <button key={r._id} onClick={() => navigate(`/orders/${r._id}`)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{r.orderNo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {r.party?.name} · {formatDate(r.createdAt)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        <span className="tabular text-sm font-medium text-slate-900">
                          {formatMoney(r.itemsTotal)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-300" />
                  </button>
                ))}
            </div>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
