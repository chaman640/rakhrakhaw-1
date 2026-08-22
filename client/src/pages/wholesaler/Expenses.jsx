import { useMemo, useState } from 'react';
import {
  Plus, Wallet, Trash2, Pencil, Search, TrendingDown, CalendarDays,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, Button, Badge, Chips, EmptyState, SkeletonRows,
  ConfirmModal, useToast,
} from '@/components/ui';
import ExpenseFormModal from './expenses/ExpenseFormModal';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * DUKAAN KA KHARCH.
 *
 * Ab tak app sirf ye batati thi ki kitna BIKA. Par mahine ke aakhir me sawal
 * hota hai "bacha kitna?" — aur uska jawab tabhi milta hai jab chai, petrol,
 * tankhwah aur kiraya bhi likhe hon. Ye page unhi ke liye hai.
 *
 * Yahan har cheez ek hi baat maan kar banayi gayi hai: kharch likhna ek "kaam"
 * nahi lagna chahiye. Isliye button hamesha saamne hai, parda ek tap me khulta
 * hai, aur shreni chip hain.
 */

const RANGES = [
  { value: 'month', label: 'Is mahine' },
  { value: 'last', label: 'Pichhla mahina' },
  { value: 'year', label: 'Is saal' },
  { value: 'all', label: 'Sab' },
];

function rangeDates(value) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (value === 'month') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
  if (value === 'last') {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (value === 'year') {
    // Hindustan ka saal April se — CA ko yahi chahiye hota hai
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: iso(new Date(y, 3, 1)), to: iso(now) };
  }
  return {};
}

const MODE_TONE = { CASH: 'slate', UPI: 'brand', BANK: 'blue', CHEQUE: 'amber' };

export default function Expenses({ embedded = false }) {
  const toast = useToast();
  const { can } = useAuth();

  const [range, setRange] = useState('month');
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const dates = useMemo(() => rangeDates(range), [range]);
  const params = { ...dates, category, q: debouncedQ, page, limit: 30 };

  const { rows, meta, loading } = useListQuery(
    ['expenses', 'list', params],
    () => api.get('/expenses', { params }),
    { onError: (err) => toast.error(err.message) },
  );

  const { data: stats } = useQuery(
    ['expenses', 'stats'],
    () => api.get('/expenses/stats').then((r) => r.data),
  );

  const { data: categories } = useQuery(
    ['expenses', 'categories'],
    () => api.get('/expenses/categories').then((r) => r.data),
  );

  /*
    Chip me sirf WO shreniyan jo is dukaan me sach me likhi ja chuki hain.
    Poori list (11 chip) yahan dikhana bekaar hai — filter ke liye wahi kaam ki
    hai jo maujood ho. Likhte waqt poori list milti hai (parde me).
  */
  const categoryChips = useMemo(() => {
    const all = [...(categories?.standard || []), ...(categories?.custom || [])]
      .filter((c) => c.count > 0)
      .sort((a, b) => b.amount - a.amount);
    return [{ value: 'all', label: 'Sab' }, ...all.map((c) => ({ value: c.value, label: c.label }))];
  }, [categories]);

  async function doDelete() {
    setDeleting(true);
    try {
      const res = await api.delete(`/expenses/${toDelete._id}`);
      toast.success(res.message);
      bust('expenses', 'reports', 'dashboard');
      setToDelete(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const openNew = () => { setEditing(null); setFormOpen(true); };

  return (
    <>
      {/* `embedded` — wajah PartyList.jsx me likhi hai */}
      {embedded ? (
        can('expenses:create') && (
          <div className="mb-4 flex justify-end">
            <Button icon={Plus} onClick={openNew}>{t('Kharch likhein')}</Button>
          </div>
        )
      ) : (
        <PageHeader
          title={t('Kharch')}
          subtitle={t('Chai, petrol, tankhwah, kiraya — jo bhi paisa maal ke alawa bahar gaya')}
          action={can('expenses:create') && (
            <Button icon={Plus} onClick={openNew}>{t('Kharch likhein')}</Button>
          )}
        />
      )}

      {/* ── upar ki ginti ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('Is mahine')} value={formatMoney(stats?.monthAmount || 0)}
          sub={`${stats?.monthCount || 0} entry`} icon={TrendingDown} tone="amber" />
        <Stat label={t('Aaj')} value={formatMoney(stats?.todayAmount || 0)}
          sub={`${stats?.todayCount || 0} entry`} icon={CalendarDays} tone="slate" />
        {(stats?.topCategories || []).slice(0, 2).map((c) => (
          <Stat key={c.category} label={t(c.label)} value={formatMoney(c.amount)}
            sub={t('is mahine')} icon={Wallet} tone="slate" />
        ))}
      </div>

      {/* ── chhantni ── */}
      <Card className="mb-5" padding={false}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder={t('Kisko diya, note ya number se dhundhein...')}
            aria-label={t('Kisko diya, note ya number se dhundhein...')}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="space-y-2 px-3 py-2">
          <div className="overflow-x-auto">
            <Chips value={range} onChange={(v) => { setRange(v); setPage(1); }} options={RANGES} />
          </div>
          {categoryChips.length > 1 && (
            <div className="overflow-x-auto">
              <Chips value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={categoryChips} />
            </div>
          )}
        </div>
      </Card>

      {/* ── list ── */}
      <Card padding={false}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-500">
            {meta.total} {t('entry')}
          </p>
          <p className="tabular text-sm font-semibold text-slate-900">
            {formatMoney(meta.filteredAmount || 0)}
          </p>
        </div>

        {loading ? (
          <SkeletonRows rows={7} />
        ) : !rows.length ? (
          <EmptyState
            icon={Wallet}
            title={t('Is duration me koi kharch nahi')}
            message={t('Chai, petrol, mazdoori — jo bhi paisa gaya, yahan likh dein. Mahine ke aakhir me asli fayda tabhi dikhega.')}
            action={can('expenses:create') && (
              <Button icon={Plus} onClick={openNew}>{t('Pehla kharch likhein')}</Button>
            )}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((e) => (
              <li key={e._id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-slate-900">{t(e.categoryLabel)}</span>
                    <Badge tone={MODE_TONE[e.mode] || 'slate'}>{t(e.mode)}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {formatDate(e.date)}
                    {e.paidTo && ` · ${e.paidTo}`}
                    {e.note && <span className="hidden sm:inline"> · {e.note}</span>}
                  </p>
                </div>

                <p className="tabular w-24 shrink-0 text-right text-sm font-semibold text-slate-900">
                  {formatMoney(e.amount)}
                </p>

                <div className="flex shrink-0 items-center">
                  {can('expenses:edit') && (
                    <IconBtn label={t('Badlein')} onClick={() => { setEditing(e); setFormOpen(true); }}>
                      <Pencil size={16} />
                    </IconBtn>
                  )}
                  {can('expenses:delete') && (
                    <IconBtn label={t('Hatayein')} danger onClick={() => setToDelete(e)}>
                      <Trash2 size={16} />
                    </IconBtn>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <Button size="sm" variant="secondary" disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}>{t('Pichla page')}</Button>
            <span className="text-xs text-slate-500">{page} / {meta.totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}>{t('Agla page')}</Button>
          </div>
        )}
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        {t('Ye kharch "Fayda-Nuksan" report me apne aap ghat jate hain.')}
      </p>

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        expense={editing}
        categories={categories}
        onSaved={() => bust('expenses')}
      />

      <ConfirmModal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        title={t('Ye kharch hata dein?')}
        confirmLabel={t('Haan, hatayein')}
        message={toDelete
          ? `${t(toDelete.categoryLabel)} · ${formatMoney(toDelete.amount)} · ${formatDate(toDelete.date)} — ${t('ye wapas nahi aayega. Register me likha rahega ki kisne hataya.')}`
          : ''}
      />
    </>
  );
}

function Stat({ label, value, sub, icon: Icon, tone }) {
  const tones = { amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-600' };
  return (
    <Card className="flex items-start gap-3 p-3 sm:p-4">
      {/*
        Icon 390px ke phone pe chhup jata hai. Do tile ek line me hain, aur
        icon 48px kha leta tha — natija ye ki "₹13,650.00" kat kar "₹13,6…"
        reh jata tha. Ginti hi is tile ka poora matlab hai; icon sirf sajaawat.
      */}
      <div className={cn('hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg xs:flex', tones[tone])}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-500">{label}</p>
        <p className="tabular mt-0.5 truncate text-base font-semibold text-slate-900 xs:text-lg">{value}</p>
        <p className="truncate text-[11px] text-slate-400">{sub}</p>
      </div>
    </Card>
  );
}

function IconBtn({ label, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors focus-ring sm:w-10',
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  );
}
