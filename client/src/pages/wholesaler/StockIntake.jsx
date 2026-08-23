import { useNavigate } from 'react-router-dom';
import {
  PackagePlus, ChevronRight, Store, CheckCircle2, Ban, Clock, Receipt,
} from 'lucide-react';
import api from '@/lib/api';
import { useListQuery } from '@/hooks/useQuery';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, Badge, Chips, Pagination, EmptyState, SkeletonRows, useToast,
} from '@/components/ui';
import { useState } from 'react';
import { t } from '@/lib/i18n';

/**
 * "KHAREEDA HUA MAAL STOCK ME DAALEIN" — jo kaam baaki hain unki list.
 *
 * Pehle ye kaam kahin likha hi nahi jata tha. Doosre wholesaler ka bill aata,
 * aur dukaandaar ko wahi bees item apne app me DOBARA haath se banane padte —
 * naam, unit, HSN, rate, quantity. Aksar wo tal jata tha, aur uska stock
 * chup-chaap jhooth bolne lagta tha: bikta wo maal jo app ke hisaab se tha hi
 * nahi.
 *
 * Ab bill bante hi ye kaam apne aap yahan aa jata hai, poora bhara hua.
 */

const TABS = [
  { value: 'PENDING', label: 'Baaki hai' },
  { value: 'DONE', label: 'Ho gaya' },
  { value: 'CANCELLED', label: 'Cancel' },
];

export default function StockIntake() {
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);

  const { rows, meta, loading } = useListQuery(
    ['stock-intake', { status, page }],
    () => api.get('/stock-intake', { params: { status, page, limit: 20 } }),
    { onError: (err) => toast.error(err.message) },
  );

  return (
    <>
      <PageHeader
        title={t('Maal stock me daalein')}
        subtitle={t('Doosri dukaan se jo maal aaya, use apne stock me chadhayein')}
      />

      <Card className="mb-5" padding={false}>
        <div className="p-4">
          <Chips
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={TABS}
          />
        </div>
      </Card>

      <Card padding={false}>
        {loading ? (
          <SkeletonRows />
        ) : !rows.length ? (
          <EmptyState
            icon={PackagePlus}
            title={status === 'PENDING' ? t('Koi kaam baaki nahi') : t('Yahan kuch nahi hai')}
            message={status === 'PENDING'
              ? t('Jab doosri dukaan aapko bill degi, uska maal yahan apne aap aa jayega.')
              : t('Doosri chhalni chun kar dekhein.')}
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => (
                <li key={row._id}>
                  <button
                    onClick={() => navigate(`/stock-intake/${row._id}`)}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 focus-ring"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      row.status === 'DONE' ? 'bg-emerald-50 text-emerald-700'
                        : row.status === 'CANCELLED' ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-700'}`}>
                      {row.status === 'DONE' ? <CheckCircle2 size={18} />
                        : row.status === 'CANCELLED' ? <Ban size={18} />
                          : <PackagePlus size={18} />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-medium text-slate-900">{row.sellerName}</span>
                        {row.status === 'PENDING' && row.pendingCount < row.itemCount && (
                          <Badge tone="brand">
                            {t('{a} / {b} ho gaya', { a: row.itemCount - row.pendingCount, b: row.itemCount })}
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Receipt size={11} /> {row.sourceInvoiceNo}
                        </span>
                        <span>·</span>
                        <span>{formatDate(row.invoiceDate)}</span>
                        <span>·</span>
                        <span>{t('{n} item', { n: row.itemCount })}</span>
                      </span>
                    </span>

                    <span className="tabular shrink-0 text-sm font-semibold text-slate-900">
                      {formatMoney(row.grandTotal)}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>

      {status === 'PENDING' && rows.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Clock size={14} className="mt-0.5 shrink-0 text-slate-400" />
          {t('Jab tak ye kaam baaki hai, ye maal aapke stock me nahi hai — bechne par stock minus me chala jayega.')}
        </p>
      )}

      {status === 'PENDING' && !rows.length && !loading && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Store size={14} className="mt-0.5 shrink-0 text-slate-400" />
          {t('Doosri dukaan se maal mangwane ke liye Profile me Buyer chunein.')}
        </p>
      )}
    </>
  );
}
