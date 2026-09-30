import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileSignature, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useListQuery } from '@/hooks/useQuery';
import { useSessionState } from '@/hooks/useSessionState';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, Button, Badge, Chips, SearchInput, Pagination, EmptyState, SkeletonRows, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { QUOTE_STATUS } from './quotations/quoteShared';

export default function Quotations() {
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [status, setStatus] = useSessionState('quotes:status', 'open');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [dq, status]);
  const { rows, meta, loading } = useListQuery(['quotations', { status, q: dq, page }], () => api.get('/quotations', { params: { status, q: dq, page } }), { onError: (e) => toast.error(e.message) });
  const c = meta?.counts || {};
  const n = (k) => c[k]?.count || 0;
  const openValue = ['draft', 'sent', 'accepted'].reduce((a, k) => a + (c[k]?.value || 0), 0);

  return (
    <>
      <PageHeader title={t('Quotations')} subtitle={t('Price offers → sales order → dispatch → bill')}
        action={can('orders:create') && <Button icon={Plus} onClick={() => navigate('/quotations/new')}>{t('New quotation')}</Button>} />
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[['Open offers', formatMoney(openValue)], ['Waiting reply', n('sent')], ['Won (orders)', n('converted')]].map(([l, v]) => (
          <Card key={l} className="!p-3"><p className="text-xs text-slate-500">{t(l)}</p><p className="truncate text-base font-semibold text-slate-900 tabular-nums">{v}</p></Card>
        ))}
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Chips value={status} onChange={setStatus} options={[
          { value: 'open', label: 'Open', count: n('draft') + n('sent') + n('accepted') }, { value: 'sent', label: 'Sent', count: n('sent') },
          { value: 'converted', label: 'Order created' }, { value: 'expired', label: 'Expired', count: n('expired') }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder={t('Quote no., customer or phone')} className="sm:ml-auto sm:w-72" />
      </div>
      <Card padding={false}>
        {loading && !rows.length ? <div className="p-4"><SkeletonRows rows={5} /></div>
          : !rows.length ? <EmptyState icon={FileSignature} title={t('No quotations')} message={t('Send price offers to big buyers and turn them into orders with one tap.')}
            action={can('orders:create') && <Button onClick={() => navigate('/quotations/new')}>{t('New quotation')}</Button>} />
            : (
              <ul className="divide-y divide-slate-100">
                {rows.map((x) => (
                  <li key={x._id}>
                    <button type="button" onClick={() => navigate(`/quotations/${x._id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{x.customer?.shopName || x.customer?.name}{x.leadId && !x.partyId && <span className="ml-1.5 text-xs font-normal text-slate-400">({t('lead')})</span>}</span>
                        <span className="block truncate text-xs text-slate-500">{x.quoteNo} · {formatDate(x.quoteDate)}{x.validUntil ? ` · ${t('valid till')} ${formatDate(x.validUntil)}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatMoney(x.total)}</span>
                      <Badge tone={QUOTE_STATUS[x.status]?.[1]}>{t(QUOTE_STATUS[x.status]?.[0])}</Badge>
                      <ChevronRight size={15} className="shrink-0 text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </Card>
      {meta && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onChange={setPage} />}
    </>
  );
}
