import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Users, ChevronRight, X } from 'lucide-react';
import api from '@/lib/api';
import { useListQuery } from '@/hooks/useQuery';
import { useSessionState } from '@/hooks/useSessionState';
import { useDebounce } from '@/hooks/useDebounce';
import { useFeature } from '@/hooks/useBilling';
import { formatMoney, formatPhone } from '@/lib/format';
import {
  Card, SearchInput, Select, Input, Button, Pagination, EmptyState, SkeletonRows, Chips, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { SEGMENT, SegmentBadges, ScorePill, daysText } from './crmShared';

const BLANK = { city: '', tag: '', segment: '', minSale: '', inactiveDays: '', overdue: '', sort: 'sale' };

export default function Customers() {
  const navigate = useNavigate();
  const toast = useToast();
  const advanced = useFeature('crm_leads').allowed;
  const smart = useFeature('crm_smart').allowed;
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [f, setF] = useSessionState('crm:custFilter', BLANK);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => { setPage(1); }, [dq, f]);

  const params = Object.fromEntries(Object.entries({ ...f, q: dq, page }).filter(([, v]) => v !== '' && v !== null));
  const { rows, meta, loading } = useListQuery(['crm', 'customers', params], () => api.get('/crm/customers', { params }), { onError: (e) => toast.error(e.message) });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const active = Object.entries(f).filter(([k, v]) => k !== 'sort' && v).length;

  const segOptions = [{ value: '', label: 'All' }, ...Object.entries(SEGMENT).map(([v, [l]]) => ({ value: v, label: l, count: meta?.segments?.[v] }))];
  const sorts = [['sale', 'Top buyers'], ['outstanding', 'Most outstanding'], ['recent', 'Recently ordered'], ['idle', 'Longest idle'], ['name', 'Name'], ...(smart ? [['score', 'Best score']] : [])];

  return (
    <div className="space-y-3">
      {meta?.totals && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Customers', meta.totals.customers], ['Total sale', formatMoney(meta.totals.sale)], ['Outstanding', formatMoney(meta.totals.outstanding)]].map(([l, v]) => (
            <Card key={l} className="!p-3"><p className="text-xs text-slate-500">{t(l)}</p><p className="truncate text-base font-semibold text-slate-900 tabular-nums">{v}</p></Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder={t('Name, phone or GSTIN')} className="min-w-[200px] flex-1" />
        <div className="w-full sm:w-48"><Select aria-label={t('Sort')} value={f.sort} onChange={set('sort')} options={sorts.map(([value, label]) => ({ value, label: t(label) }))} /></div>
        <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setShowFilters((v) => !v)}>
          {t('Filters')}{active ? ` (${active})` : ''}
        </Button>
      </div>

      {advanced && <Chips options={segOptions} value={f.segment} onChange={set('segment')} />}

      {showFilters && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label={t('City')} value={f.city} onChange={set('city')} options={[{ value: '', label: t('All cities') }, ...(meta?.cities || []).map((c) => ({ value: c, label: c }))]} />
            <Select label={t('Tag')} value={f.tag} onChange={set('tag')} options={[{ value: '', label: t('All tags') }, ...(meta?.tags || []).map((c) => ({ value: c, label: c }))]} />
            {advanced ? (
              <>
                <Input label={t('Bought at least')} type="number" prefix="₹" value={f.minSale} onChange={set('minSale')} placeholder="50000" />
                <Input label={t('No order for (days)')} type="number" value={f.inactiveDays} onChange={set('inactiveDays')} placeholder="30" />
                <Select label={t('Payment')} value={f.overdue} onChange={set('overdue')} options={[{ value: '', label: t('Any') }, { value: '1', label: t('Payment overdue') }]} />
              </>
            ) : <p className="self-end text-xs text-slate-500 sm:col-span-2">{t('Sale amount, inactivity and overdue filters are in the ₹100 plan and above.')}</p>}
          </div>
          {active > 0 && <Button variant="ghost" size="sm" icon={X} className="mt-2" onClick={() => setF({ ...BLANK, sort: f.sort })}>{t('Clear filters')}</Button>}
        </Card>
      )}

      <Card padding={false}>
        {loading && !rows.length ? <div className="p-4"><SkeletonRows rows={6} /></div>
          : !rows.length ? <EmptyState icon={Users} title={t('No customers found')} message={active || dq ? t('Try removing a filter.') : t('Add retailers to see them here.')} />
            : (
              <>
                <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_24px] gap-3 border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 md:grid">
                  <span>{t('Customer')}</span><span>{t('City')}</span><span className="text-right">{t('Total sale')}</span><span className="text-right">{t('Outstanding')}</span><span className="text-right">{t('Last order')}</span><span />
                </div>
                <ul className="divide-y divide-slate-100">
                  {rows.map((c) => (
                    <li key={c._id}>
                      <button type="button" onClick={() => navigate(`/crm/customers/${c._id}`)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_24px] md:gap-3">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-medium text-slate-900">{c.shopName || c.name}</span>
                            <ScorePill score={c.score} />
                            {advanced && <SegmentBadges list={c.segments} />}
                          </span>
                          <span className="block truncate text-xs text-slate-500">{[c.shopName && c.name, formatPhone(c.phone), c.assignedToName && `→ ${c.assignedToName}`].filter(Boolean).join(' · ')}</span>
                          <span className="mt-0.5 block text-xs text-slate-500 md:hidden">{[c.city, `${t('Sale')} ${formatMoney(c.totalSale)}`, daysText(c.daysSince)].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="hidden truncate text-sm text-slate-600 md:block">{c.city || '—'}</span>
                        <span className="hidden text-right text-sm tabular-nums text-slate-900 md:block">{formatMoney(c.totalSale)}</span>
                        <span className={cn('text-right text-sm tabular-nums', c.overdue > 0 ? 'font-semibold text-red-600' : c.outstanding > 0 ? 'text-amber-700' : 'text-slate-500')}>
                          {formatMoney(Math.max(0, c.outstanding))}
                        </span>
                        <span className="hidden text-right text-sm text-slate-600 md:block">{daysText(c.daysSince)}</span>
                        <ChevronRight size={15} className="hidden text-slate-300 md:block" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
      </Card>
      {meta && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onChange={setPage} />}
    </div>
  );
}
