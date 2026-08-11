import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, IndianRupee, Calendar, TriangleAlert, ChevronRight, Plus,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Select, Input, Pagination, EmptyState, useToast,
} from '@/components/ui';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Udhaar', partial: 'Kuch mila', paid: 'Mil gaya' };

export default function Invoices() {
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({});
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [partyId, setPartyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', {
        params: { q: debouncedQ, paymentStatus, partyId, from: from || undefined, to: to || undefined, page, limit: 25 },
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, paymentStatus, partyId, from, to, page]);

  useEffect(() => {
    api.get('/invoices/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/parties', { params: { type: 'retailer', limit: 200 } })
      .then((r) => setRetailers(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, paymentStatus, partyId, from, to]);

  const columns = [
    {
      key: 'invoiceNo', header: 'Bill',
      render: (r) => (
        <button onClick={() => navigate(`/invoices/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.invoiceNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.invoiceDate)}</p>
        </button>
      ),
    },
    { key: 'party', header: 'Retailer', render: (r) => r.party?.name || '—' },
    { key: 'grandTotal', header: 'Kul', align: 'right', render: (r) => formatMoney(r.grandTotal) },
    {
      key: 'dueAmount', header: 'Baaki', align: 'right',
      render: (r) => (r.dueAmount > 0
        ? <span className="tabular font-medium text-amber-700">{formatMoney(r.dueAmount)}</span>
        : <span className="text-slate-400">—</span>),
    },
    {
      key: 'paymentStatus', header: 'Status',
      render: (r) => (r.isCancelled
        ? <Badge tone="red">Cancelled</Badge>
        : <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/invoices/${r._id}`)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Kholein">
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Bill banate hi stock ghatta hai aur khata banta hai"
        action={<Button icon={Plus} onClick={() => navigate('/invoices/new')}>Naya bill</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Kul bills" value={stats.totalInvoices || 0} icon={FileText} tone="brand" />
        <StatCard label="Kul sale" value={formatMoney(stats.totalAmount || 0)} icon={IndianRupee} tone="green" />
        <StatCard label="Is mahine" value={formatMoney(stats.monthAmount || 0)} icon={Calendar} tone="brand"
          sub={`${stats.monthCount || 0} bill`} />
        <StatCard label="Udhaar baaki" value={formatMoney(stats.totalDue || 0)} icon={TriangleAlert}
          tone={stats.totalDue > 0 ? 'amber' : 'green'} />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Bill number ya retailer..."
            className="w-full sm:w-56" />
          <Chips value={paymentStatus} onChange={setPaymentStatus}
            options={[
              { value: 'all', label: 'Sab' },
              { value: 'unpaid', label: 'Udhaar' },
              { value: 'partial', label: 'Kuch mila' },
              { value: 'paid', label: 'Mil gaya' },
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
            icon={FileText}
            title="Abhi koi bill nahi"
            message="Order tayyar ho jaye to uspe 'Bill banayein' dabaein — ya yahin se seedha naya bill banayein."
            action={<Button icon={Plus} onClick={() => navigate('/invoices/new')}>Pehla bill</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
                : rows.map((r) => (
                  <button key={r._id} onClick={() => navigate(`/invoices/${r._id}`)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{r.invoiceNo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {r.party?.name} · {formatDate(r.invoiceDate)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {r.isCancelled
                          ? <Badge tone="red">Cancelled</Badge>
                          : <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>}
                        <span className="tabular text-sm font-medium text-slate-900">
                          {formatMoney(r.grandTotal)}
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
