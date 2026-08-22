import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Truck, IndianRupee, Calendar, TriangleAlert, ChevronRight,
  Phone, MessageCircle, HandCoins,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatDate, formatPhone } from '@/lib/format';
import { waLink } from '@/lib/share';
import {
  PageHeader, Card, StatCard, Button, Table, Badge, SearchInput, Chips,
  Select, Input, Pagination, EmptyState, SkeletonRows, Tabs, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import PaymentFormModal from './payments/PaymentFormModal';
import { t } from '@/lib/i18n';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Udhaar', partial: 'Kuch diya', paid: 'Diya' };

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

function dayName(key) {
  const today = dayKey(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (key === today) return t('Aaj');
  if (key === dayKey(y)) return t('Kal');
  const [yy, mm, dd] = key.split('-');
  return new Date(Number(yy), Number(mm) - 1, Number(dd))
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function ageOf(date) {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return t('aaj ka');
  if (days === 1) return t('kal ka');
  if (days < 30) return `${days} ${t('din purana')}`;
  const months = Math.floor(days / 30);
  return months === 1 ? t('1 mahina purana') : `${months} ${t('mahine purana')}`;
}

const ageTone = (date) => {
  if (!date) return 'text-slate-400';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days >= 45) return 'text-red-600 font-medium';
  if (days >= 15) return 'text-amber-700';
  return 'text-slate-400';
};

/**
 * PURCHASE — maal andar aaya.
 *
 * Ye page Sale ka aaina hai, aur wo jaan-boojh kar hai. Dukaandaar ke dimaag
 * me do hi list hoti hain: "kya bika" aur "kya aaya". Dono ek jaisi dikhein
 * to doosri seekhni hi nahi padti — wahi din ki patti, wahi chip, wahi patli
 * line.
 *
 * Doosra tab "Dena hai" hai — Payment page ke "Lena hai" ka aaina. Ye pehle
 * app me kahin tha hi nahi: supplier ko kitna dena hai, ye sirf Khata page pe
 * type badal kar dikhta tha, aur wahan se paisa dene ka koi rasta nahi tha.
 *
 * Dena hai wale tab ko `khata:view` chahiye — godown wale ke paas purchase ki
 * chaabi hoti hai par paise ki nahi, aur wo theek hai. Us halat me tab dikhta
 * hi nahi (khali tab dikhana usse bura hai).
 */
export default function Purchases({ embedded = false }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();

  const canSeeDue = can('khata:view');
  const tab = canSeeDue && params.get('tab') === 'dena' ? 'dena' : 'list';

  const [payFor, setPayFor] = useState(null);

  const { data: stats = {} } = useQuery(
    ['purchases', 'stats'], () => api.get('/purchases/stats').then((r) => r.data),
  );

  return (
    <>
      {/* `embedded` — wajah PartyList.jsx me likhi hai */}
      {embedded ? (
        <div className="mb-4 flex justify-end">
          <Button icon={Plus} onClick={() => navigate('/purchases/new')}>{t('Nayi purchase')}</Button>
        </div>
      ) : (
        <PageHeader
          title={t('Purchase')}
          subtitle={t('Supplier se aaya maal — stock apne aap badhta hai')}
          action={<Button icon={Plus} onClick={() => navigate('/purchases/new')}>{t('Nayi purchase')}</Button>}
        />
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Kul purchases')} value={stats.totalPurchases || 0} icon={Truck} tone="brand" />
        <StatCard label={t('Kul kharch')} value={formatMoney(stats.totalAmount || 0)} icon={IndianRupee} tone="brand" />
        <StatCard label={t('Is mahine')} value={formatMoney(stats.thisMonthAmount || 0)} icon={Calendar} tone="green"
          sub={`${stats.thisMonthCount || 0} purchase`} />
        <StatCard label={t('Suppliers ko dena')} value={formatMoney(stats.totalDue || 0)} icon={TriangleAlert}
          tone={stats.totalDue > 0 ? 'amber' : 'green'} />
      </div>

      {canSeeDue && (
        <Tabs
          value={tab}
          onChange={(v) => {
            if (v === 'list') params.delete('tab');
            else params.set('tab', v);
            setParams(params, { replace: true });
          }}
          tabs={[
            { value: 'list', label: 'Maal aaya' },
            { value: 'dena', label: 'Dena hai' },
          ]}
        />
      )}

      {tab === 'dena'
        ? <DueList onPay={(party) => setPayFor(party)} onOpen={(party) => navigate(`/suppliers/${party._id}?tab=khata`)} />
        : <PurchaseList navigate={navigate} />}

      <PaymentFormModal
        open={!!payFor}
        fixedParty={payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => bust('purchases', 'khata', 'payments', 'dashboard', 'parties')}
      />
    </>
  );
}

/* ══════════════════════ 1. Maal aaya ══════════════════════ */

function PurchaseList({ navigate }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [range, setRange] = useState('month');
  const [supplierId, setSupplierId] = useState('');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);

  const dates = range === 'custom' ? custom : rangeFor(range);
  const params = {
    q: debouncedQ, supplierId, paymentStatus,
    from: dates.from || undefined, to: dates.to || undefined, page, limit: 25,
  };

  const { rows, meta, loading } = useListQuery(
    ['purchases', params],
    () => api.get('/purchases', { params }),
    { onError: (err) => toast.error(err.message) },
  );
  const { data: suppliers = [] } = useQuery(
    ['parties', 'supplier', 'chunne-ke-liye'],
    () => api.get('/parties', { params: { type: 'supplier', limit: 200 } }).then((r) => r.data),
  );

  useEffect(() => { setPage(1); }, [debouncedQ, supplierId, paymentStatus, range, custom.from, custom.to]);

  const groups = useMemo(() => {
    const totals = Object.fromEntries((meta?.dayTotals || []).map((x) => [x.date, x]));
    const out = [];
    for (const r of rows) {
      const key = dayKey(r.purchaseDate);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, total: totals[key] || null, rows: [r] });
    }
    return out;
  }, [rows, meta]);

  const showGroups = Array.isArray(meta?.dayTotals);
  const hasFilters = Boolean(debouncedQ || supplierId || paymentStatus !== 'all' || range !== 'all');

  const columns = [
    {
      key: 'purchaseNo', header: t('Purchase'),
      render: (r) => (
        <button onClick={() => navigate(`/purchases/${r._id}`)} className="text-left">
          <p className="font-medium text-slate-900">{r.purchaseNo}</p>
          <p className="text-xs text-slate-500">
            {formatDate(r.purchaseDate)}{r.supplierBillNo && ` · ${r.supplierBillNo}`}
          </p>
        </button>
      ),
    },
    // Bina supplier wali kharid ko "—" dikhana galat hai: wo khali khaana nahi,
    // ek alag KISM ki entry hai. Naam dena hi use pehchaan deta hai.
    { key: 'supplier', header: t('Supplier'),
      render: (r) => (r.supplier?.name || <span className="text-slate-400">{t('Nakad kharid')}</span>) },
    { key: 'itemCount', header: t('Items'), align: 'right', render: (r) => r.itemCount },
    { key: 'grandTotal', header: t('Kul'), align: 'right', render: (r) => formatMoney(r.grandTotal) },
    {
      key: 'dueAmount', header: t('Baaki'), align: 'right',
      render: (r) => (r.dueAmount > 0
        ? <span className="tabular font-medium text-amber-700">{formatMoney(r.dueAmount)}</span>
        : <span className="text-slate-400">—</span>),
    },
    {
      key: 'paymentStatus', header: t('Status'),
      render: (r) => <Badge tone={payTone[r.paymentStatus]}>{t(payLabel[r.paymentStatus])}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <button onClick={() => navigate(`/purchases/${r._id}`)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={t('Kholein')}>
          <ChevronRight size={18} />
        </button>
      ),
    },
  ];

  return (
    <>
      <Card className="mb-4 mt-4" padding={false}>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SearchInput value={q} onChange={setQ} placeholder={t('Number ya bill se dhundhein...')}
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
                { value: 'partial', label: t('Kuch diya') },
                { value: 'paid', label: t('Diya') },
              ]} />
            <div className="w-full sm:w-44">
              <Select placeholder={t('Sab suppliers')} value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={suppliers.map((s) => ({ value: s._id, label: s.shopName || s.name }))} />
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
            icon={Truck}
            title={hasFilters ? t('Is duration me koi purchase nahi') : t('Abhi koi purchase nahi')}
            message={hasFilters
              ? t('Upar wale chip se duration badal kar dekhein.')
              : t('Supplier se maal aaye to yahan entry karein — stock apne aap badh jayega aur unka khata bhi bante jayega.')}
            action={<Button icon={Plus} onClick={() => navigate('/purchases/new')}>{t('Nayi purchase')}</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              {loading ? <SkeletonRows /> : showGroups ? (
                groups.map((g, i) => (
                  <div key={g.key}>
                    <DayHeader day={g.key} total={g.total} />
                    <Table columns={columns} rows={g.rows} hideHeader={i > 0} />
                  </div>
                ))
              ) : <Table columns={columns} rows={rows} />}
            </div>

            <div className="md:hidden">
              {loading ? <SkeletonRows /> : (showGroups ? groups : [{ key: 'x', total: null, rows }]).map((g) => (
                <div key={g.key}>
                  {showGroups && <DayHeader day={g.key} total={g.total} />}
                  {g.rows.map((r) => (
                    <button key={r._id} onClick={() => navigate(`/purchases/${r._id}`)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {r.supplier?.name || t('Nakad kharid')}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {r.purchaseNo}{r.itemCount > 0 && ` · ${r.itemCount} ${t('item')}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold text-slate-900">{formatMoney(r.grandTotal)}</p>
                        {r.dueAmount > 0
                          ? <p className="tabular text-xs font-medium text-amber-700">{formatMoney(r.dueAmount)} {t('baaki')}</p>
                          : <p className="text-xs text-emerald-700">{t('Diya')}</p>}
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
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

function DayHeader({ day, total }) {
  return (
    <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-y border-slate-100 bg-slate-50 px-4 py-2 first:border-t-0">
      <p className="text-sm font-semibold text-slate-900">{dayName(day)}</p>
      {total && (
        <p className="tabular shrink-0 text-xs text-slate-500">
          {total.bills} {t('purchase')} · <span className="font-medium text-slate-700">{formatMoney(total.amount)}</span>
          {total.due > 0 && <span className="text-amber-700"> · {formatMoney(total.due)} {t('baaki')}</span>}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════ 2. Dena hai ══════════════════════ */

function DueList({ onPay, onOpen }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [sort, setSort] = useState('-balance');
  const [page, setPage] = useState(1);

  const params = { q: debouncedQ, sort, type: 'supplier', page, limit: 20 };
  const { rows, meta, loading } = useListQuery(
    ['khata', 'due', params],
    () => api.get('/khata/due', { params }),
    { onError: (err) => toast.error(err.message) },
  );

  useEffect(() => { setPage(1); }, [debouncedQ, sort]);

  return (
    <>
      <Card className="mb-4 mt-4" padding={false}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Naam ya number...')}
            className="w-full sm:w-56" />
          <Chips value={sort} onChange={setSort}
            options={[
              { value: '-balance', label: t('Sabse zyada') },
              { value: 'oldest', label: t('Purana pehle') },
              { value: 'name', label: t('Naam se') },
            ]} />
        </div>
      </Card>

      <Card padding={false}>
        {!loading && rows.length > 0 && (
          <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">{meta.total} {t('supplier ko dena hai')}</p>
            <p className="tabular text-base font-semibold text-amber-700">
              {formatMoney(meta.totalDue || 0)}
            </p>
          </div>
        )}

        {loading ? <SkeletonRows /> : !rows.length ? (
          <EmptyState
            icon={HandCoins}
            title={q ? t('Is naam se koi nahi mila') : t('Kisi supplier ka paisa baaki nahi')}
            message={q ? t('Naam ya number dobara dekh lein.') : t('Sabka hisaab saaf hai — badhiya baat hai.')}
          />
        ) : (
          <>
            <ul>
              {rows.map((p) => (
                <SupplierDueRow key={p._id} p={p} onPay={() => onPay(p)} onOpen={() => onOpen(p)} />
              ))}
            </ul>
            {/* ginti upar header me pehle se hai */}
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} showTotal={false} />
          </>
        )}
      </Card>
    </>
  );
}

function SupplierDueRow({ p, onPay, onOpen }) {
  const name = p.shopName || p.name;
  const age = ageOf(p.oldestDue);
  const msg = `Namaste ${p.name}, aapka ₹${Math.round(p.balance)} baaki hai. Bhej raha hoon. Dhanyawaad.`;

  return (
    <li className="border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={onOpen} className="min-w-0 flex-1 rounded text-left focus-ring">
          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">
            {p.phone ? formatPhone(p.phone) : t('number nahi hai')}
            {p.openBills > 0 && ` · ${p.openBills} ${t('purchase khuli')}`}
          </p>
          {age && <p className={cn('mt-0.5 text-xs', ageTone(p.oldestDue))}>{age}</p>}
        </button>

        <div className="shrink-0 text-right">
          <p className="tabular text-base font-semibold text-amber-700">{formatMoney(p.balance)}</p>
          <div className="mt-1.5 flex items-center justify-end gap-1">
            {p.phone && (
              <>
                <a href={`tel:${p.phone}`} aria-label={t('Phone karein')} title={t('Phone karein')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-ring">
                  <Phone size={15} />
                </a>
                <a href={waLink(msg, p.phone)} target="_blank" rel="noreferrer"
                  aria-label={t('WhatsApp pe likhein')} title={t('WhatsApp pe likhein')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 focus-ring">
                  <MessageCircle size={15} />
                </a>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={onPay}>{t('Paisa diya')}</Button>
          </div>
        </div>
      </div>
    </li>
  );
}
