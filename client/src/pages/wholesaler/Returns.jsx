import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Undo2, Plus, ChevronRight, PackageX, ArrowDownLeft, ArrowUpRight, Calendar,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Input, Pagination, EmptyState, SkeletonRows, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

const TYPE_LABEL = {
  SALE_RETURN: 'Maal wapas aaya',
  PURCHASE_RETURN: 'Maal wapas bheja',
};
const TYPE_TONE = { SALE_RETURN: 'amber', PURCHASE_RETURN: 'blue' };
const NOTE_LABEL = { SALE_RETURN: 'Credit Note', PURCHASE_RETURN: 'Debit Note' };

export default function Returns() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [stats, setStats] = useState({});

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const params = { q: debouncedQ, type, from: from || undefined, to: to || undefined, page, limit: 25 };

  // Purana turant, naya peeche-peeche
  const { rows, meta, loading } = useListQuery(
    ['returns', params],
    () => api.get('/returns', { params }),
    { onError: (err) => toast.error(err.message) },
  );

  /** Kuch badla — jo bhi iss pe tika hai wo apne aap taaza ho jayega */
  // `payments` bhi — wapasi ka paisa wapas karne se ek payment banti hai
  const refresh = () => bust('returns', 'khata', 'items', 'dashboard', 'payments');

  useEffect(() => {
    api.get('/returns/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [debouncedQ, type, from, to]);

  const columns = [
    {
      key: 'returnNo', header: t('Note'),
      render: (r) => (
        <button onClick={() => navigate(`/returns/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.returnNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.returnDate)}</p>
        </button>
      ),
    },
    { key: 'party', header: t('Party'), render: (r) => r.party?.name || '—' },
    {
      key: 'type', header: t('Kya hua'),
      render: (r) => <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge>,
    },
    {
      key: 'againstNo', header: t('Kis bill ka'),
      render: (r) => (r.againstNo
        ? <span className="text-slate-600">{r.againstNo}</span>
        : <span className="text-slate-400">{t('Bina bill')}</span>),
    },
    { key: 'itemCount', header: t('Item'), align: 'right' },
    {
      key: 'grandTotal', header: t('Amount'), align: 'right',
      render: (r) => <span className="font-medium">{formatMoney(r.grandTotal)}</span>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/returns/${r._id}`)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t('Kholein')}>
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('Return')}
        subtitle={t('Maal wapas aaya ya bheja — stock aur khata dono apne aap theek ho jate hain')}
        action={<Button icon={Plus} onClick={() => navigate('/returns/new')}>{t('Naya return')}</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Wapas aaya (kul)')} value={formatMoney(stats.saleAmount || 0)}
          icon={ArrowDownLeft} tone="amber" sub={`${stats.saleCount || 0} credit note`} />
        <StatCard label={t('Is mahine wapas aaya')} value={formatMoney(stats.saleMonthAmount || 0)}
          icon={Calendar} tone="amber" />
        <StatCard label={t('Wapas bheja (kul)')} value={formatMoney(stats.purchaseAmount || 0)}
          icon={ArrowUpRight} tone="brand" sub={`${stats.purchaseCount || 0} debit note`} />
        <StatCard label={t('Is mahine wapas bheja')} value={formatMoney(stats.purchaseMonthAmount || 0)}
          icon={Calendar} tone="brand" />
      </div>

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Note number, bill ya party...')}
            className="w-full sm:w-56" />
          <Chips value={type}
            onChange={(v) => { setType(v); setSearchParams(v === 'all' ? {} : { type: v }); }}
            options={[
              { value: 'all', label: t('Dono') },
              { value: 'SALE_RETURN', label: t('Wapas aaya') },
              { value: 'PURCHASE_RETURN', label: t('Wapas bheja') },
            ]} />
          <div className="w-36"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-36"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={PackageX}
            title={t('Abhi koi return nahi')}
            message={t("Retailer maal wapas kare ya aap supplier ko wapas bhejein — yahin entry karein. Bill kholkar 'Maal wapas aaya' dabana sabse aasan hai.")}
            action={<Button icon={Plus} onClick={() => navigate('/returns/new')}>{t('Pehla return')}</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <SkeletonRows />
                : rows.map((r) => (
                  <button key={r._id} onClick={() => navigate(`/returns/${r._id}`)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{r.returnNo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {r.party?.name} · {formatDate(r.returnDate)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={TYPE_TONE[r.type]}>{NOTE_LABEL[r.type]}</Badge>
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

export { TYPE_LABEL, TYPE_TONE, NOTE_LABEL };
