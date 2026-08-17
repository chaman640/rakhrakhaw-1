import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, IndianRupee, Calendar, TriangleAlert, ChevronRight, Plus,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery } from '@/hooks/useQuery';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Select, Input, Pagination, EmptyState, SkeletonCards, SkeletonRows, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Udhaar', partial: 'Kuch mila', paid: 'Mil gaya' };

export default function Invoices() {
  const toast = useToast();
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [partyId, setPartyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const params = {
    q: debouncedQ, paymentStatus, partyId,
    from: from || undefined, to: to || undefined, page, limit: 25,
  };

  // Purana turant, naya peeche-peeche — `loading` sirf sabse pehli baar
  const { rows, meta, loading } = useListQuery(
    ['invoices', params],
    () => api.get('/invoices', { params }),
    { onError: (err) => toast.error(err.message) },
  );

  const { data: stats = {} } = useQuery(
    ['invoices', 'stats'], () => api.get('/invoices/stats').then((r) => r.data),
  );
  const { data: retailers = [] } = useQuery(
    ['parties', 'retailer', 'chunne-ke-liye'],
    () => api.get('/parties', { params: { type: 'retailer', limit: 200 } }).then((r) => r.data),
  );

  useEffect(() => { setPage(1); }, [debouncedQ, paymentStatus, partyId, from, to]);

  const columns = [
    {
      key: 'invoiceNo', header: t('Bill'),
      render: (r) => (
        <button onClick={() => navigate(`/invoices/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.invoiceNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.invoiceDate)}</p>
        </button>
      ),
    },
    { key: 'party', header: t('Retailer'), render: (r) => r.party?.name || '—' },
    { key: 'grandTotal', header: t('Kul'), align: 'right', render: (r) => formatMoney(r.grandTotal) },
    {
      key: 'dueAmount', header: t('Baaki'), align: 'right',
      render: (r) => (r.dueAmount > 0
        ? <span className="tabular font-medium text-amber-700">{formatMoney(r.dueAmount)}</span>
        : <span className="text-slate-400">—</span>),
    },
    {
      key: 'paymentStatus', header: t('Status'),
      render: (r) => (r.isCancelled
        ? <Badge tone="red">{t('Cancelled')}</Badge>
        : <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge>),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/invoices/${r._id}`)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t('Kholein')}>
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('Invoices')}
        subtitle={t('Bill banate hi stock ghatta hai aur khata banta hai')}
        action={<Button icon={Plus} onClick={() => navigate('/invoices/new')}>{t('Naya bill')}</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Kul bills')} value={stats.totalInvoices || 0} icon={FileText} tone="brand" />
        <StatCard label={t('Kul sale')} value={formatMoney(stats.totalAmount || 0)} icon={IndianRupee} tone="green" />
        <StatCard label={t('Is mahine')} value={formatMoney(stats.monthAmount || 0)} icon={Calendar} tone="brand"
          sub={`${stats.monthCount || 0} bill`} />
        <StatCard label={t('Udhaar baaki')} value={formatMoney(stats.totalDue || 0)} icon={TriangleAlert}
          tone={stats.totalDue > 0 ? 'amber' : 'green'} />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Bill number ya retailer...')}
            className="w-full sm:w-56" />
          <Chips value={paymentStatus} onChange={setPaymentStatus}
            options={[
              { value: 'all', label: t('Sab') },
              { value: 'unpaid', label: t('Udhaar') },
              { value: 'partial', label: t('Kuch mila') },
              { value: 'paid', label: t('Mil gaya') },
            ]} />
          <div className="w-44">
            <Select placeholder={t('Sab retailers')} value={partyId}
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
            title={t('Abhi koi bill nahi')}
            message="Order tayyar ho jaye to uspe 'Bill banayein' dabaein — ya yahin se seedha naya bill banayein."
            action={<Button icon={Plus} onClick={() => navigate('/invoices/new')}>{t('Pehla bill')}</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <SkeletonRows />
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
                          ? <Badge tone="red">{t('Cancelled')}</Badge>
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
