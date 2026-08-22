import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, TrendingUp, TrendingDown, TriangleAlert, ChevronRight, Wallet, Phone } from
'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatDate, formatPhone } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, StatCard, Button, SearchInput, Chips,
  Pagination, EmptyState, Badge, SkeletonRows, useToast } from
'@/components/ui';
import { BalanceLine } from './khata/LedgerTable';
import { t } from '@/lib/i18n';

export default function Khata() {
  const toast = useToast();
  const navigate = useNavigate();

  const [summary, setSummary] = useState({});

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [type, setType] = useState('retailer');
  const [filter, setFilter] = useState('due');
  const [page, setPage] = useState(1);

  const params = { q: debouncedQ, type, filter, page, limit: 25 };

  // Purana turant, naya peeche-peeche
  const { rows, meta, loading } = useListQuery(
    ['khata', params],
    () => api.get('/khata', { params }),
    { onError: (err) => toast.error(err.message) }
  );

  /** Kuch badla — jo bhi iss pe tika hai wo apne aap taaza ho jayega */
  const refresh = () => bust('khata', 'parties', 'dashboard');

  const loadSummary = useCallback(() => {
    api.get('/khata/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  useEffect(() => {loadSummary();}, [loadSummary]);
  useEffect(() => {setPage(1);}, [debouncedQ, type, filter]);

  const openParty = (r) =>
  navigate(r.type === 'supplier' ? `/suppliers/${r._id}?tab=khata` : `/retailers/${r._id}?tab=khata`);

  return (
    <>
      <PageHeader
        title={t('Khata')}
        subtitle={t('Kisse kitna lena hai, kisko kitna dena hai — sab ek jagah')}
        action={<Button icon={Wallet} onClick={() => navigate('/payments')}>{t('Payments')}</Button>} />
      

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Lena hai (retailers se)')} value={formatMoney(summary.receivable || 0)}
        icon={TrendingUp} tone={summary.receivable > 0 ? 'amber' : 'green'}
        sub={`${summary.retailersWithDue || 0} dukaan pe udhaar`} />
        <StatCard label={t('Dena hai (suppliers ko)')} value={formatMoney(summary.payable || 0)}
        icon={TrendingDown} tone={summary.payable > 0 ? 'red' : 'green'} />
        <StatCard label={t('Net')} value={formatMoney(summary.net || 0)} icon={BookOpen}
        tone={summary.net >= 0 ? 'brand' : 'red'} sub={t("Lena − dena")} />
        <StatCard label={t('Limit se upar')} value={summary.overLimit || 0} icon={TriangleAlert}
        tone={summary.overLimit > 0 ? 'red' : 'green'} sub={t("Credit limit paar")} />
      </div>

      {summary.topDebtors?.length > 0 &&
      <Card className="mb-5">
          <CardHeader title={t('Sabse zyada udhaar')} subtitle={t('Inko phone karna banta hai')} />
          <div className="flex flex-wrap gap-2">
            {summary.topDebtors.map((d) =>
          <button key={d._id} onClick={() => navigate(`/retailers/${d._id}?tab=khata`)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-ring">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{d.shopName || d.name}</p>
                  <p className="tabular text-xs font-semibold text-red-600">{formatMoney(d.balance)}</p>
                </div>
              </button>
          )}
          </div>
        </Card>
      }

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Naam ya phone...')} className="w-full sm:w-56" />
          <Chips value={type} onChange={setType}
          options={[
          { value: 'retailer', label: t('Retailers') },
          { value: 'supplier', label: t('Suppliers') },
          { value: 'all', label: t('Dono') }]
          } />
          <Chips value={filter} onChange={setFilter}
          options={[
          { value: 'due', label: t('Baaki hai') },
          { value: 'clear', label: t('Clear') },
          { value: 'all', label: t('Sab') }]
          } />
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ?
        <EmptyState
          icon={BookOpen}
          title={filter === 'due' ? 'Kisi pe udhaar nahi' : 'Koi party nahi mili'}
          message={filter === 'due' ?
          'Sabka hisaab barabar hai. Bill banega tab yahan udhaar dikhega.' :
          'Pehle retailer ya supplier add karein.'} /> :


        <>
            {loading ?
          <SkeletonRows /> :
          rows.map((r) =>
          <button key={r._id} onClick={() => openParty(r)}
          className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition-colors last:border-0 hover:bg-slate-50">
                <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
              aria-hidden="true">
              
                  {(r.shopName || r.name || '?').charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{r.shopName || r.name}</p>
                    {r.overLimit && <Badge tone="red">{t('Limit paar')}</Badge>}
                    {r.status === 'blocked' && <Badge tone="slate">{t('Band')}</Badge>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <Phone size={11} className="shrink-0" /> {formatPhone(r.phone)}
                    {r.lastActivity && <span className="hidden sm:inline">· {formatDate(r.lastActivity)}</span>}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <BalanceLine balance={r.balance} type={r.type} />
                  {r.creditLimit > 0 &&
              <p className="mt-0.5 text-[11px] text-slate-400">{t("Limit {a0}", { a0: formatMoney(r.creditLimit) })}</p>
              }
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300" />
              </button>
          )}
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
          limit={meta.limit} onChange={setPage} />
          </>
        }
      </Card>
    </>);

}
