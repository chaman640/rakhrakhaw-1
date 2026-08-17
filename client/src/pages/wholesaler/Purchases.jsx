import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Truck, IndianRupee, Calendar, TriangleAlert, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Select, Input, Pagination, EmptyState, SkeletonRows, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Udhaar', partial: 'Kuch diya', paid: 'Diya' };

export default function Purchases() {
  const navigate = useNavigate();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ totalPurchases: 0, totalAmount: 0, totalDue: 0, thisMonthAmount: 0 });
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [supplierId, setSupplierId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const loadStats = useCallback(async () => {
    try { setStats((await api.get('/purchases/stats')).data); } catch { /* chup-chaap */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/purchases', {
        params: { q: debouncedQ, supplierId, paymentStatus, from: from || undefined, to: to || undefined, page, limit: 25 },
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, supplierId, paymentStatus, from, to, page]);

  useEffect(() => {
    loadStats();
    api.get('/parties', { params: { type: 'supplier', limit: 200 } })
      .then((r) => setSuppliers(r.data)).catch(() => {});
  }, [loadStats]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, supplierId, paymentStatus, from, to]);

  const hasFilters = Boolean(debouncedQ || supplierId || paymentStatus !== 'all' || from || to);

  const columns = [
    {
      key: 'purchaseNo',
      header: t('Purchase'),
      render: (r) => (
        <button onClick={() => navigate(`/purchases/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.purchaseNo}</p>
          <p className="text-xs text-slate-500">
            {formatDate(r.purchaseDate)}{r.supplierBillNo && ` · ${r.supplierBillNo}`}
          </p>
        </button>
      ),
    },
    { key: 'supplier', header: t('Supplier'), render: (r) => r.supplier?.name || '—' },
    { key: 'itemCount', header: t('Items'), align: 'right', render: (r) => r.itemCount },
    { key: 'grandTotal', header: t('Kul'), align: 'right', render: (r) => formatMoney(r.grandTotal) },
    {
      key: 'dueAmount',
      header: t('Baaki'),
      align: 'right',
      render: (r) => (r.dueAmount > 0
        ? <span className="tabular font-medium text-amber-700">{formatMoney(r.dueAmount)}</span>
        : <span className="text-slate-400">—</span>),
    },
    {
      key: 'paymentStatus',
      header: t('Status'),
      render: (r) => <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/purchases/${r._id}`)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t('Kholein')}>
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('Purchases')}
        subtitle={t('Supplier se aaya maal — stock apne aap badhta hai')}
        action={<Button icon={Plus} onClick={() => navigate('/purchases/new')}>{t('Nayi purchase')}</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Kul purchases')} value={stats.totalPurchases} icon={Truck} tone="brand" />
        <StatCard label={t('Kul kharch')} value={formatMoney(stats.totalAmount)} icon={IndianRupee} tone="brand" />
        <StatCard label={t('Is mahine')} value={formatMoney(stats.thisMonthAmount)} icon={Calendar} tone="green"
          sub={`${stats.thisMonthCount || 0} purchase`} />
        <StatCard label={t('Suppliers ko dena')} value={formatMoney(stats.totalDue)} icon={TriangleAlert}
          tone={stats.totalDue > 0 ? 'amber' : 'green'} />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Number ya bill se dhundhein...')}
            className="w-full sm:w-56" />
          <Chips value={paymentStatus} onChange={setPaymentStatus}
            options={[
              { value: 'all', label: t('Sab') },
              { value: 'unpaid', label: t('Udhaar') },
              { value: 'partial', label: t('Kuch diya') },
              { value: 'paid', label: t('Diya') },
            ]} />
          <div className="w-44">
            <Select placeholder={t('Sab suppliers')} value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s._id, label: s.shopName || s.name }))} />
          </div>
          <div className="w-36"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-36"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={Truck}
            title={hasFilters ? 'Is filter me kuch nahi mila' : 'Abhi koi purchase nahi'}
            message={hasFilters
              ? 'Filter hata kar dobara dekhein.'
              : 'Supplier se maal aaye to yahan entry karein — stock apne aap badh jayega aur unka khata bhi bante jayega.'}
            action={<Button icon={Plus} onClick={() => navigate('/purchases/new')}>{t('Pehli purchase')}</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <SkeletonRows />
                : rows.map((r) => (
                  <button key={r._id} onClick={() => navigate(`/purchases/${r._id}`)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{r.purchaseNo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {r.supplier?.name} · {formatDate(r.purchaseDate)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>
                        <span className="tabular text-sm font-medium text-slate-900">{formatMoney(r.grandTotal)}</span>
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
