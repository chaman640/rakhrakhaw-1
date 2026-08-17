import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Printer, Share2, ChevronRight, Search, IndianRupee, Receipt,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery } from '@/hooks/useQuery';
import { useBillActions } from '@/hooks/useBillActions';
import { formatMoney, formatDate, formatPhone } from '@/lib/format';
import {
  Card, Button, Badge, Chips, EmptyState, SkeletonRows, Spinner, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * HOME — roz ka kaam.
 *
 * Dashboard "hisaab" dikhata hai (kitna bika, kitna baaki). Home "kaam"
 * dikhata hai: aaj kya kya becha, aur uska bill kise bhejna hai. Isliye yahan
 * bade tile aur chart nahi hain — patli patli lines hain, jitni ek screen me
 * aa sakein utni.
 *
 * Do tarah se dekh sakte hain:
 *   Sab sale   — ek ek bill, naya sabse upar
 *   Party wise — ek retailer ki ek line, sabse zyada kharidne wala upar
 *
 * Neeche "Add Sale" hamesha chipka rehta hai. Bill banana is app ka sabse
 * zyada hone wala kaam hai — uske liye menu kholna nahi padna chahiye.
 */

/* Roz ke chunav — "kab se kab tak" bharne se bachate hain */
const RANGES = [
  { value: 'today', label: 'Aaj' },
  { value: 'week', label: '7 din' },
  { value: 'month', label: 'Is mahine' },
  { value: 'all', label: 'Sab' },
];

function rangeDates(value) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (value === 'today') return { from: iso(now), to: iso(now) };
  if (value === 'week') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: iso(from), to: iso(now) };
  }
  if (value === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(from), to: iso(now) };
  }
  return {};
}

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const { can, user } = useAuth();
  const { shareBill, busyId } = useBillActions();

  const [tab, setTab] = useState('bills');
  const [range, setRange] = useState('month');
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);

  const dates = useMemo(() => rangeDates(range), [range]);
  const canSeeBills = can('invoices:view');

  /* ── tab 1: ek ek bill ── */
  const listParams = {
    ...dates, q: debouncedQ, page: 1, limit: 30, sort: '-invoiceDate', status: 'active',
  };
  const { rows: bills, meta, loading: billsLoading } = useListQuery(
    ['invoices', 'home', listParams],
    () => api.get('/invoices', { params: listParams }),
    { enabled: canSeeBills && tab === 'bills', onError: (err) => toast.error(err.message) },
  );

  /* ── tab 2: party wise ── */
  const { data: parties = [], loading: partyLoading } = useQuery(
    ['invoices', 'by-party', dates],
    () => api.get('/invoices/by-party', { params: dates }).then((r) => r.data),
    { enabled: canSeeBills && tab === 'parties' },
  );

  /* ── upar ki do ginti ── */
  const { data: stats } = useQuery(
    ['invoices', 'stats'],
    () => api.get('/invoices/stats').then((r) => r.data),
    { enabled: canSeeBills },
  );

  const shownParties = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return parties;
    return parties.filter((p) => `${p.name} ${p.subName} ${p.phone}`.toLowerCase().includes(needle));
  }, [parties, debouncedQ]);

  if (!canSeeBills) {
    return (
      <EmptyState
        icon={Receipt}
        title={t('Ye page aapke liye nahi khula')}
        message={t('Dukaan ke malik ne aapko is hisse ki ijazat nahi di hai. Zarurat ho to unse kahiye.')}
      />
    );
  }

  return (
    <div className="pb-16">
      {/* ───────── upar: aaj ka hisaab ───────── */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <MiniStat
          label={t('Aaj ki sale')}
          value={formatMoney(stats?.todayAmount || 0)}
          sub={`${stats?.todayCount || 0} bill`}
          tone="brand"
        />
        <MiniStat
          label={t('Udhaar baaki')}
          value={formatMoney(stats?.totalDue || 0)}
          sub={t('sab milakar')}
          tone={stats?.totalDue > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* ───────── dhoondhna aur samay ───────── */}
      <Card className="mb-4" padding={false}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Naam, number ya bill se dhundhein...')}
            aria-label={t('Naam, number ya bill se dhundhein...')}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {q && (
            <button onClick={() => setQ('')} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">
              {t('Saaf karein')}
            </button>
          )}
        </div>
        <div className="overflow-x-auto px-3 py-2">
          <Chips value={range} onChange={setRange} options={RANGES} />
        </div>
      </Card>

      {/* ───────── do tab ───────── */}
      <div className="mb-3 flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'bills'} onClick={() => setTab('bills')}>
          {t('Sab sale')}
        </TabButton>
        <TabButton active={tab === 'parties'} onClick={() => setTab('parties')}>
          {t('Party wise')}
        </TabButton>
      </div>

      <Card padding={false}>
        {tab === 'bills' ? (
          <BillList
            rows={bills}
            loading={billsLoading}
            total={meta.total}
            busyId={busyId}
            onOpen={(b) => navigate(`/invoices/${b._id}`)}
            onPrint={(b) => navigate(`/invoices/${b._id}?print=1`)}
            onShare={(b) => shareBill(b._id)}
            onAdd={() => navigate('/sale/new')}
          />
        ) : (
          <PartyList
            rows={shownParties}
            loading={partyLoading}
            onOpen={(p) => navigate(`/retailers/${p._id}`)}
          />
        )}
      </Card>

      {/*
        "Add Sale" hamesha ungli ke paas.

        `bottom-20` phone ke liye hai — neeche wali patti ke thoda upar, warna
        button usi ke peeche chala jata hai. Bade screen pe patti hoti hi nahi,
        isliye wahan neeche aa jata hai.
      */}
      {can('invoices:create') && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6">
          <Button
            size="lg"
            icon={Plus}
            className="pointer-events-auto shadow-xl"
            onClick={() => navigate('/sale/new')}
          >
            {t('Add Sale')}
          </Button>
        </div>
      )}

      {user?.scope === 'own' && !user?.isOwner && (
        <p className="mt-4 text-center text-xs text-slate-400">
          {t('Yahan sirf aapke apne retailer ka kaam dikh raha hai')}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, tone }) {
  const tones = {
    brand: 'text-brand-700',
    amber: 'text-amber-700',
    green: 'text-emerald-700',
  };
  return (
    <Card className="p-3 sm:p-4">
      <p className="truncate text-xs text-slate-500">{label}</p>
      <p className={cn('tabular mt-0.5 truncate text-lg font-semibold sm:text-xl', tones[tone])}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>
    </Card>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative px-4 py-2.5 text-sm font-medium transition-colors focus-ring',
        active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800',
      )}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
    </button>
  );
}

/* ─────────────────────────── tab 1: ek ek bill ─────────────────────────── */

function BillList({ rows, loading, total, busyId, onOpen, onPrint, onShare, onAdd }) {
  if (loading) return <SkeletonRows rows={8} />;

  if (!rows.length) {
    return (
      <EmptyState
        icon={Receipt}
        title={t('Is duration me koi sale nahi')}
        message={t('Upar se doosra samay chunein, ya neeche se nayi sale add karein.')}
        action={<Button icon={Plus} onClick={onAdd}>{t('Add Sale')}</Button>}
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {rows.map((b) => {
          const name = b.party?.name || b.partySnapshot?.shopName || b.partySnapshot?.name || '—';
          const phone = b.party?.phone || b.partySnapshot?.phone;
          return (
            <li key={b._id} className="flex items-center gap-2 px-3 py-2.5">
              {/* Poori line dabao to bill khul jaye — button chhote hain, line badi */}
              <button
                onClick={() => onOpen(b)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus-ring rounded-lg"
              >
                {/*
                  Gol akshar wala nishaan 390px ke phone pe CHHUP jata hai.
                  Wajah: us screen pe naam ke liye sirf ~130px bachte the aur
                  "Suresh Auto Store" kat kar "Suresh Aut…" ho jata tha. Nishaan
                  sirf sajaawat hai, naam kaam ki cheez — isliye jagah naam ko
                  di gayi. Thodi badi screen (xs = 416px) pe wo wapas aa jata hai.
                */}
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 xs:flex">
                  {name.charAt(0).toUpperCase()}
                </div>
                {/*
                  Phone 390px ka hota hai. Pehle yahan naam, number, bill no aur
                  tareekh — chaaron ek line me the, aur natija ye ki naam hi kat
                  jata tha: "Suresh Aut…". Naam sabse zaroori cheez hai, isliye
                  ab tareekh sirf badi screen pe aati hai aur rakam wale khaane
                  ki chaudai bandhi hui hai — naam ko jitni jagah mil sake mile.
                */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {formatPhone(phone)}
                    <span className="hidden xs:inline"> · {b.invoiceNo}</span>
                    <span className="hidden sm:inline"> · {formatDate(b.invoiceDate)}</span>
                  </p>
                </div>
                <div className="w-[6.75rem] shrink-0 text-right sm:w-28">
                  <p className="tabular truncate text-sm font-semibold text-slate-900">{formatMoney(b.grandTotal)}</p>
                  {b.dueAmount > 0 ? (
                    <p className="tabular truncate text-[10.5px] text-amber-700">
                      {t('baaki')} {formatMoney(b.dueAmount)}
                    </p>
                  ) : (
                    <Badge tone={payTone.paid}>{t('Mil gaya')}</Badge>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton label={t('Print')} onClick={() => onPrint(b)}>
                  <Printer size={17} />
                </IconButton>
                <IconButton label={t('WhatsApp pe bhejein')} onClick={() => onShare(b)} busy={busyId === b._id}>
                  <Share2 size={17} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      {total > rows.length && (
        <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-400">
          {t('{shown} dikha rahe hain, kul {total}', { shown: rows.length, total })}
        </p>
      )}
    </>
  );
}

function IconButton({ label, onClick, busy, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      // h-10 w-10 = 40px, gap ke saath ungli ke liye kaafi. Isse chhota karne
      // par bagal wala button dab jata hai — phone pe ye roz ki shikayat hoti hai.
      className="flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 focus-ring sm:w-10"
    >
      {busy ? <Spinner size={16} /> : children}
    </button>
  );
}

/* ─────────────────────────── tab 2: party wise ─────────────────────────── */

function PartyList({ rows, loading, onOpen }) {
  if (loading) return <SkeletonRows rows={6} />;

  if (!rows.length) {
    return (
      <EmptyState
        icon={IndianRupee}
        title={t('Is duration me kisi ne kuch nahi kharida')}
        message={t('Upar se doosra samay chunein.')}
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((p) => (
        <li key={p._id}>
          <button
            onClick={() => onOpen(p)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left focus-ring"
          >
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 xs:flex">
              {(p.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
              <p className="truncate text-xs text-slate-500">
                {formatPhone(p.phone)} · {p.bills} bill
                <span className="hidden sm:inline"> · {formatDate(p.lastDate)}</span>
              </p>
            </div>
            <div className="w-[6.75rem] shrink-0 text-right sm:w-28">
              <p className="tabular truncate text-sm font-semibold text-slate-900">{formatMoney(p.total)}</p>
              {p.due > 0 && (
                <p className="tabular truncate text-[10.5px] text-amber-700">
                  {t('baaki')} {formatMoney(p.due)}
                </p>
              )}
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </button>
        </li>
      ))}
    </ul>
  );
}
