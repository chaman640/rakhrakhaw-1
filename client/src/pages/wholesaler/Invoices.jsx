import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, IndianRupee, Calendar, TriangleAlert, ChevronRight, Plus, Printer, Send,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery } from '@/hooks/useQuery';
import { useBillActions } from '@/hooks/useBillActions';
import { formatMoney, formatDate } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Select, Input, Pagination, EmptyState, SkeletonRows, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Udhaar', partial: 'Kuch mila', paid: 'Mil gaya' };

/** Aaj / 7 din / Is mahine ke liye seedhi tareekh */
function rangeFor(key) {
  const d = new Date();
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (key === 'today') return { from: iso(d), to: iso(d) };
  if (key === 'week') { const s = new Date(d); s.setDate(s.getDate() - 6); return { from: iso(s), to: iso(d) }; }
  if (key === 'month') { const s = new Date(d); s.setDate(1); return { from: iso(s), to: iso(d) }; }
  return { from: '', to: '' };
}

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** "Aaj" / "Kal" / "12 Aug" — tareekh se zyada ye padhi jati hai */
function dayName(key) {
  const today = dayKey(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (key === today) return t('Aaj');
  if (key === dayKey(y)) return t('Kal');
  const [yy, mm, dd] = key.split('-');
  return new Date(Number(yy), Number(mm) - 1, Number(dd))
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * SALE — poora record.
 *
 * Home aur ye page alag alag kaam ke hain, aur wo farak jaan-boojh kar hai:
 *
 *   Home  — AAJ ka kaam. Bill banao, chhapo, bhejo. Choti list, bada button.
 *   Sale  — POORA record. Kis din kitna bika, kiska udhaar baaki hai, pichhle
 *           mahine ka kya hisaab tha.
 *
 * Yahan sabse badi cheez DIN KI HEADER hai — "Aaj · 8 bill · ₹42,500". Ek
 * lambi list me har bill ek jaisa dikhta hai aur dimaag me kuch nahi baithta;
 * din ka jod hi wo cheez hai jo dukaandaar sach me dhoondh raha hota hai.
 *
 * Wo jod SERVER se aata hai, page ki rows ko jod kar nahi — page 25 bill pe
 * toot ta hai aur toot aksar din ke beech me padta hai. Yahan gin lete to
 * aakhri din ka jod aadha dikhta, poore vishwas ke saath.
 */
export default function Invoices() {
  const toast = useToast();
  const navigate = useNavigate();
  // Print bill ke apne page pe hota hai (wahan poora bill maujood hai) — yahan
  // sirf wahan bhej dete hain. Bhejna yahin se ho jata hai.
  const { shareBill, busyId } = useBillActions();

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [range, setRange] = useState('month');
  const [partyId, setPartyId] = useState('');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);

  const dates = range === 'custom' ? custom : rangeFor(range);

  const params = {
    q: debouncedQ, paymentStatus, partyId,
    from: dates.from || undefined, to: dates.to || undefined, page, limit: 25,
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

  useEffect(() => { setPage(1); }, [debouncedQ, paymentStatus, partyId, range, custom.from, custom.to]);

  /*
    Rows ko din ke hisaab se baant dete hain. Jod server se aaye `dayTotals` se
    lagate hain — agar wo na aaye (jaise kisi aur kram me), to header dikhate
    hi nahi. Aadha jod dikhane se accha hai na dikhana.
  */
  const groups = useMemo(() => {
    const totals = Object.fromEntries((meta?.dayTotals || []).map((x) => [x.date, x]));
    const out = [];
    for (const r of rows) {
      const key = dayKey(r.invoiceDate);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, total: totals[key] || null, rows: [r] });
    }
    return out;
  }, [rows, meta]);

  const showGroups = Array.isArray(meta?.dayTotals);

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
        : <Badge tone={payTone[r.paymentStatus]}>{t(payLabel[r.paymentStatus])}</Badge>),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <IconBtn label={t('Print')} icon={Printer} onClick={() => navigate(`/invoices/${r._id}?print=1`)} />
          <IconBtn label={t('WhatsApp pe bhejein')} icon={Send} disabled={busyId === r._id}
            onClick={() => shareBill(r._id)} />
          <IconBtn label={t('Kholein')} icon={ChevronRight} onClick={() => navigate(`/invoices/${r._id}`)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('Sale')}
        subtitle={t('Kis din kitna bika aur kiska paisa baaki hai')}
        action={<Button icon={Plus} onClick={() => navigate('/sale/new')}>{t('Naya bill')}</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Kul bills')} value={stats.totalInvoices || 0} icon={FileText} tone="brand" />
        <StatCard label={t('Kul sale')} value={formatMoney(stats.totalAmount || 0)} icon={IndianRupee} tone="green" />
        <StatCard label={t('Is mahine')} value={formatMoney(stats.monthAmount || 0)} icon={Calendar} tone="brand"
          sub={`${stats.monthCount || 0} bill`} />
        <StatCard label={t('Udhaar baaki')} value={formatMoney(stats.totalDue || 0)} icon={TriangleAlert}
          tone={stats.totalDue > 0 ? 'amber' : 'green'} />
      </div>

      {/* ---- chhantni ---- */}
      <Card className="mb-4" padding={false}>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SearchInput value={q} onChange={setQ} placeholder={t('Bill number ya retailer...')}
              className="w-full sm:w-56" />
            <Chips value={range} onChange={setRange}
              options={[
                { value: 'today', label: t('Aaj') },
                { value: 'week', label: t('7 din') },
                { value: 'month', label: t('Is mahine') },
                { value: 'all', label: t('Sab') },
                { value: 'custom', label: t('Date chunein') },
              ]} />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Chips value={paymentStatus} onChange={setPaymentStatus}
              options={[
                { value: 'all', label: t('Sab') },
                { value: 'unpaid', label: t('Udhaar') },
                { value: 'partial', label: t('Kuch mila') },
                { value: 'paid', label: t('Mil gaya') },
              ]} />
            <div className="w-full sm:w-44">
              <Select placeholder={t('Sab retailers')} value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                options={retailers.map((r) => ({ value: r._id, label: r.shopName || r.name }))} />
            </div>
          </div>
          {range === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="w-36">
                <Input type="date" aria-label={t('Kis din se')} value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </div>
              <div className="w-36">
                <Input type="date" aria-label={t('Kis din tak')} value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={FileText}
            title={t('Is duration me koi bill nahi')}
            message={t('Upar wale chip se duration badal kar dekhein — ya yahin se naya bill banayein.')}
            action={<Button icon={Plus} onClick={() => navigate('/sale/new')}>{t('Naya bill')}</Button>}
          />
        ) : (
          <>
            {/* ---- bade screen pe table ---- */}
            <div className="hidden md:block">
              {loading ? <SkeletonRows /> : showGroups ? (
                groups.map((g, i) => (
                  <div key={g.key}>
                    <DayHeader day={g.key} total={g.total} />
                    {/* column ke naam sirf sabse upar — har din ke upar dobara nahi */}
                    <Table columns={columns} rows={g.rows} hideHeader={i > 0} />
                  </div>
                ))
              ) : <Table columns={columns} rows={rows} />}
            </div>

            {/* ---- phone pe patli line ---- */}
            <div className="md:hidden">
              {loading ? <SkeletonRows /> : (showGroups ? groups : [{ key: 'x', total: null, rows }]).map((g) => (
                <div key={g.key}>
                  {showGroups && <DayHeader day={g.key} total={g.total} />}
                  {g.rows.map((r) => (
                    <Row key={r._id} r={r} onOpen={() => navigate(`/invoices/${r._id}`)} />
                  ))}
                </div>
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

/**
 * Din ki patti — "Aaj · 8 bill · ₹42,500".
 *
 * Chipki hui (sticky) hai, isliye lambi list me neeche khiskate waqt bhi upar
 * ye dikhta rehta hai ki abhi kis din ke bill padhe ja rahe hain.
 */
function DayHeader({ day, total }) {
  return (
    <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-y border-slate-100 bg-slate-50 px-4 py-2 first:border-t-0">
      <p className="text-sm font-semibold text-slate-900">{dayName(day)}</p>
      {total && (
        <p className="tabular shrink-0 text-xs text-slate-500">
          {total.bills} {t('bill')} · <span className="font-medium text-slate-700">{formatMoney(total.amount)}</span>
          {total.due > 0 && <span className="text-amber-700"> · {formatMoney(total.due)} {t('baaki')}</span>}
        </p>
      )}
    </div>
  );
}

/**
 * Phone wali line.
 *
 * 390px pe naam sabse pehle katata hai, isliye rakam wale khaane ki chaudai
 * bandhi hui hai aur naam ko poori bachi jagah milti hai (`min-w-0` ke bina
 * flex bachcha kabhi sikudta hi nahi — wahi purani galti hai).
 */
function Row({ r, onOpen }) {
  return (
    <button onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{r.party?.name || r.invoiceNo}</p>
        <p className="truncate text-xs text-slate-500">
          {r.invoiceNo}
          {r.itemCount > 0 && ` · ${r.itemCount} ${t('item')}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-sm font-semibold text-slate-900">{formatMoney(r.grandTotal)}</p>
        {r.isCancelled ? (
          <Badge tone="red">{t('Cancelled')}</Badge>
        ) : r.dueAmount > 0 ? (
          <p className="tabular text-xs font-medium text-amber-700">{formatMoney(r.dueAmount)} {t('baaki')}</p>
        ) : (
          <p className="text-xs text-emerald-700">{t('Mil gaya')}</p>
        )}
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </button>
  );
}

/** Tap ka ghera 32px se kam kabhi nahi — ungli 28px pe chook jati hai */
function IconBtn({ label, icon: Icon, onClick, disabled }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-slate-400',
        'hover:bg-slate-100 hover:text-slate-700 focus-ring disabled:opacity-40')}>
      <Icon size={16} />
    </button>
  );
}
