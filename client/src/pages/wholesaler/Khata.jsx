import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, TrendingUp, TrendingDown, TriangleAlert, ChevronRight, Wallet, Phone,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatDate, formatPhone } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, StatCard, Button, SearchInput, Chips,
  Pagination, EmptyState, Badge, useToast,
} from '@/components/ui';
import { BalanceLine } from './khata/LedgerTable';

export default function Khata() {
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [type, setType] = useState('retailer');
  const [filter, setFilter] = useState('due');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/khata', { params: { q: debouncedQ, type, filter, page, limit: 25 } });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, type, filter, page]);

  const loadSummary = useCallback(() => {
    api.get('/khata/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, type, filter]);

  const openParty = (r) =>
    navigate(r.type === 'supplier' ? `/suppliers/${r._id}?tab=khata` : `/retailers/${r._id}?tab=khata`);

  return (
    <>
      <PageHeader
        title="Khata"
        subtitle="Kisse kitna lena hai, kisko kitna dena hai — sab ek jagah"
        action={<Button icon={Wallet} onClick={() => navigate('/payments')}>Payments</Button>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lena hai (retailers se)" value={formatMoney(summary.receivable || 0)}
          icon={TrendingUp} tone={summary.receivable > 0 ? 'amber' : 'green'}
          sub={`${summary.retailersWithDue || 0} dukaan pe udhaar`} />
        <StatCard label="Dena hai (suppliers ko)" value={formatMoney(summary.payable || 0)}
          icon={TrendingDown} tone={summary.payable > 0 ? 'red' : 'green'} />
        <StatCard label="Net" value={formatMoney(summary.net || 0)} icon={BookOpen}
          tone={summary.net >= 0 ? 'brand' : 'red'} sub="Lena − dena" />
        <StatCard label="Limit se upar" value={summary.overLimit || 0} icon={TriangleAlert}
          tone={summary.overLimit > 0 ? 'red' : 'green'} sub="Credit limit paar" />
      </div>

      {summary.topDebtors?.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Sabse zyada udhaar" subtitle="Inko phone karna banta hai" />
          <div className="flex flex-wrap gap-2">
            {summary.topDebtors.map((d) => (
              <button key={d._id} onClick={() => navigate(`/retailers/${d._id}?tab=khata`)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-ring">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{d.shopName || d.name}</p>
                  <p className="tabular text-xs font-semibold text-red-600">{formatMoney(d.balance)}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Naam ya phone..." className="w-full sm:w-56" />
          <Chips value={type} onChange={setType}
            options={[
              { value: 'retailer', label: 'Retailers' },
              { value: 'supplier', label: 'Suppliers' },
              { value: 'all', label: 'Dono' },
            ]} />
          <Chips value={filter} onChange={setFilter}
            options={[
              { value: 'due', label: 'Baaki hai' },
              { value: 'clear', label: 'Clear' },
              { value: 'all', label: 'Sab' },
            ]} />
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={BookOpen}
            title={filter === 'due' ? 'Kisi pe udhaar nahi' : 'Koi party nahi mili'}
            message={filter === 'due'
              ? 'Sabka hisaab barabar hai. Bill banega tab yahan udhaar dikhega.'
              : 'Pehle retailer ya supplier add karein.'}
          />
        ) : (
          <>
            {loading ? (
              <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
            ) : rows.map((r) => (
              <button key={r._id} onClick={() => openParty(r)}
                className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition-colors last:border-0 hover:bg-slate-50">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
                  aria-hidden="true"
                >
                  {(r.shopName || r.name || '?').charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{r.shopName || r.name}</p>
                    {r.overLimit && <Badge tone="red">Limit paar</Badge>}
                    {r.status === 'blocked' && <Badge tone="slate">Band</Badge>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <Phone size={11} className="shrink-0" /> {formatPhone(r.phone)}
                    {r.lastActivity && <span className="hidden sm:inline">· {formatDate(r.lastActivity)}</span>}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <BalanceLine balance={r.balance} type={r.type} />
                  {r.creditLimit > 0 && (
                    <p className="mt-0.5 text-[11px] text-slate-400">Limit {formatMoney(r.creditLimit)}</p>
                  )}
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300" />
              </button>
            ))}
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
