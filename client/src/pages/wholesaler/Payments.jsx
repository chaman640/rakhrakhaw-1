import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wallet, Plus, IndianRupee, Calendar, Clock, Trash2, Check, X, Phone,
  Banknote, Smartphone, Landmark, FileCheck, HandCoins, TriangleAlert, MessageCircle,
  PiggyBank,
} from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatDate, formatPhone } from '@/lib/format';
import { waLink } from '@/lib/share';
import {
  PageHeader, Card, CardHeader, StatCard, Button, Table, Badge, SearchInput,
  Chips, Input, Pagination, EmptyState, Modal, Textarea, ConfirmModal,
  SkeletonRows, Tabs, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import PaymentFormModal from './payments/PaymentFormModal';
import { t } from '@/lib/i18n';

const MODE_ICON = { CASH: Banknote, UPI: Smartphone, BANK: Landmark, CHEQUE: FileCheck };
const statusTone = { pending: 'amber', confirmed: 'green', failed: 'red' };
const statusLabel = { pending: 'Confirm karna hai', confirmed: 'Ho gaya', failed: 'Reject' };

/** Kitna purana — "5 din", "2 mahine". Number se zyada ye baat samajh aati hai. */
function ageOf(date) {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return t('aaj ka');
  if (days === 1) return t('kal ka');
  if (days < 30) return `${days} ${t('din purana')}`;
  const months = Math.floor(days / 30);
  return months === 1 ? t('1 mahina purana') : `${months} ${t('mahine purana')}`;
}

/** 45 din se upar wale ko laal — yahi wo hai jispe phone karna hai */
const ageTone = (date) => {
  if (!date) return 'text-slate-400';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days >= 45) return 'text-red-600 font-medium';
  if (days >= 15) return 'text-amber-700';
  return 'text-slate-400';
};

/**
 * PAYMENT — pehle "kisse lena hai", phir "kya kya hua".
 *
 * Purana page sirf ek HISTORY tha: kaunsi entry kab hui. Wo zaroori hai, par
 * wo sawal nahi hai jo dukaandaar leke aata hai. Uska sawal ek hi hota hai —
 * "aaj kisko phone karun?" — aur uska jawab is page pe hai hi nahi tha; uske
 * liye Khata page alag se kholna padta tha, aur wahan se paisa entry karne ke
 * liye teesri jagah jana padta tha.
 *
 * Ab pehla tab "Lena hai" hai:
 *   - kis retailer ka kitna baaki hai, sabse zyada ya sabse PURANA upar
 *   - ₹5,000 kal ka aur ₹5,000 teen mahine purana ek jaise nahi hote, isliye
 *     har line pe umar likhi hai aur 45 din se upar wali laal hai
 *   - wahin se: paisa aaya (parda khulta hai, party pehle se bhari hui),
 *     phone, aur WhatsApp pe yaad dilana
 *
 * History doosre tab me hai — poori, jaisi thi.
 *
 * Confirm karne wali payment (retailer ne UPI bheja) dono tab ke UPAR rehti
 * hai, kyunki wo kisi tab ki cheez nahi — wo aaj ka kaam hai.
 */
export default function Payments() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /*
    History PEHLE — dukaandaar ne kaha, aur wajah bhi saaf hai: din me sabse
    zyada wo "abhi kya kya hua" dekhne aata hai. "Lena hai" hafte me do baar
    ka kaam hai; wo doosre tab me ek tap door rehta hai.
  */
  const [tab, setTab] = useState(searchParams.get('tab') || 'history');

  const [formFor, setFormFor] = useState(null);     // null | { party } | { }
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [reminding, setReminding] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: stats = {} } = useQuery(
    ['payments', 'stats'], () => api.get('/payments/stats').then((r) => r.data),
  );
  const { data: pending = [] } = useQuery(
    ['payments', 'pending'],
    () => api.get('/payments', { params: { status: 'pending', limit: 20 } }).then((r) => r.data),
  );

  const refreshAll = () => bust('payments', 'khata', 'dashboard', 'invoices', 'parties');

  async function confirm(p) {
    setBusy(true);
    try {
      const res = await api.post(`/payments/${p._id}/confirm`);
      toast.success(res.message);
      refreshAll();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  async function doReject() {
    setBusy(true);
    try {
      const res = await api.post(`/payments/${rejecting._id}/reject`, { reason: rejectReason.trim() });
      toast.success(res.message);
      setRejecting(null); setRejectReason('');
      refreshAll();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await api.delete(`/payments/${deleting._id}`);
      toast.success(res.message);
      setDeleting(null);
      refreshAll();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  async function doRemind() {
    setBusy(true);
    try {
      const res = await api.post(`/khata/${reminding._id}/remind`, {});
      toast.success(res.message);
      setReminding(null);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title={t('Payment')}
        subtitle={t('Kisse lena hai, aur ab tak kya kya aaya')}
        action={<Button icon={Plus} onClick={() => setFormFor({})}>{t('Paisa entry')}</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('Aaj aaya')} value={formatMoney(stats.todayAmount || 0)} icon={IndianRupee}
          tone="green" sub={`${stats.todayCount || 0} payment`} />
        <StatCard label={t('Is mahine')} value={formatMoney(stats.monthAmount || 0)} icon={Calendar}
          tone="brand" sub={`${stats.monthCount || 0} payment`} />
        <StatCard label={t('Confirm karna hai')} value={stats.pendingCount || 0} icon={Clock}
          tone={stats.pendingCount > 0 ? 'amber' : 'green'} sub={formatMoney(stats.pendingAmount || 0)} />
        {/*
          "Kul lena hai" kabhi gayab nahi hota.

          Pehle jama paisa hone par ye tile JAMA wale tile se badal jati thi.
          Wo galat tha: page ka sabse bada sawal hi hat jata tha, aur wo bhi
          tab jab kisi ek graahak ne thoda zyada paisa de diya ho. Ab dono ek
          hi tile pe hain — bada number wahi jo dukaandaar dhoondhta hai, aur
          jama uske neeche ek line me, jahan se Jama tab ek tap door hai.
        */}
        <StatCard label={t('Kul lena hai')} value={formatMoney(stats.totalReceivable || 0)}
          icon={stats.totalAdvance > 0 ? PiggyBank : HandCoins}
          tone={stats.totalReceivable > 0 ? 'amber' : 'green'}
          sub={stats.totalAdvance > 0
            ? `${formatMoney(stats.totalAdvance)} ${t('jama bhi pada hai')}`
            : undefined} />
      </div>

      {/* ---- Confirm karne wali payment — dono tab ke upar ---- */}
      {pending.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/40">
          <CardHeader
            title={`${pending.length} ${t('payment confirm karna hai')}`}
            subtitle={t('Retailer ne bheja hai — apna account check karke haan/na karein')}
          />
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p._id}
                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {p.party?.name} — {formatMoney(p.amount)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {p.mode} · {formatDate(p.date)}
                    {p.reference && ` · UTR ${p.reference}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="success" icon={Check} loading={busy}
                    onClick={() => confirm(p)}>{t('Mil gaya')}</Button>
                  <Button size="sm" variant="secondary" icon={X}
                    onClick={() => setRejecting(p)}>{t('Nahi mila')}</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs
        tabs={[
          { value: 'history', label: 'History' },
          { value: 'due', label: 'Lena hai' },
          // Jama paisa tabhi dikhega jab kisi ka hai — warna khali tab
          // sirf uljhata hai
          ...(stats.totalAdvance > 0 ? [{ value: 'jama', label: 'Jama' }] : []),
        ]}
        value={tab}
        onChange={(k) => { setTab(k); setSearchParams(k === 'history' ? {} : { tab: k }); }}
      />

      {tab === 'due' && (
        <DueList
          onCollect={(party) => setFormFor({ party })}
          onRemind={(party) => setReminding(party)}
          onOpen={(party) => navigate(`/retailers/${party._id}?tab=khata`)}
        />
      )}
      {tab === 'jama' && (
        <JamaList
          onRefund={(party) => setFormFor({ party, refund: true })}
          onOpen={(party) => navigate(`/retailers/${party._id}?tab=khata`)}
        />
      )}
      {tab === 'history' && (
        <History
          searchParams={searchParams} setSearchParams={setSearchParams}
          onReject={setRejecting} onDelete={setDeleting} onConfirm={confirm}
          busy={busy} navigate={navigate}
        />
      )}

      <PaymentFormModal
        open={!!formFor}
        fixedParty={formFor?.party || null}
        defaultRefund={!!formFor?.refund}
        onClose={() => setFormFor(null)}
        onSaved={refreshAll}
      />

      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setRejectReason(''); }}
        title={t('Payment reject karein?')}
        description={rejecting ? `${rejecting.party?.name} ne ${formatMoney(rejecting.amount)} bheja bataya tha` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejecting(null); setRejectReason(''); }}>
              {t('Rehne dein')}
            </Button>
            <Button variant="danger" onClick={doReject} loading={busy}>{t('Reject karein')}</Button>
          </>
        }
      >
        <Textarea
          label={t('Kya wajah batayein')}
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t('Jaise: account me paisa nahi aaya')}
          hint={t('Retailer ko yahi message jayega')}
        />
      </Modal>

      <ConfirmModal
        open={!!reminding}
        onClose={() => setReminding(null)}
        onConfirm={doRemind}
        loading={busy}
        title={reminding ? `${reminding.shopName || reminding.name} ko yaad dilayein?` : ''}
        message={t('Inke app me alert chala jayega ki itna paisa baaki hai. WhatsApp bhejna ho to uske bagal wala button dabaein.')}
        confirmLabel={t("Haan, yaad dilayein")}
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={busy}
        title={deleting ? `${deleting.paymentNo} delete karein?` : ''}
        message={t('Khata wapas pehle jaisa ho jayega aur bill dobara udhaar dikhne lagega. Ye wapas nahi hota.')}
        confirmLabel={t("Haan, delete karein")}
      />
    </>
  );
}

/* ══════════════════════════ 1. Lena hai ══════════════════════════ */

function DueList({ onCollect, onRemind, onOpen }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [sort, setSort] = useState('-balance');
  const [page, setPage] = useState(1);

  const params = { q: debouncedQ, sort, page, limit: 20 };
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
        {/*
          Jod header me hai, list ke andar nahi — kyunki ye POORI list ka jod
          hai, is page ka nahi. Server hi ye bhejta hai; yahan rows jod kar
          nikalte to page 2 pe number chhota ho jata.
        */}
        {!loading && rows.length > 0 && (
          <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              {meta.total} {t('retailer se lena hai')}
            </p>
            <p className="tabular text-base font-semibold text-amber-700">
              {formatMoney(meta.totalDue || 0)}
            </p>
          </div>
        )}

        {loading ? <SkeletonRows /> : !rows.length ? (
          <EmptyState
            icon={HandCoins}
            title={q ? t('Is naam se koi nahi mila') : t('Kisi ka udhaar baaki nahi')}
            message={q ? t('Naam ya number dobara dekh lein.') : t('Sabka hisaab saaf hai — badhiya baat hai.')}
          />
        ) : (
          <>
            <ul>
              {rows.map((p) => (
                <DueRow key={p._id} p={p}
                  onCollect={() => onCollect(p)}
                  onRemind={() => onRemind(p)}
                  onOpen={() => onOpen(p)} />
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

function DueRow({ p, onCollect, onRemind, onOpen }) {
  const name = p.shopName || p.name;
  const age = ageOf(p.oldestDue);
  const msg = `Namaste ${p.name}, ${name} pe ₹${Math.round(p.amount)} baaki hai. Jab suvidha ho bhej dijiyega. Dhanyawaad.`;

  return (
    <li className="border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left focus-ring rounded">
          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">
            {p.phone ? formatPhone(p.phone) : t('number nahi hai')}
            {p.openBills > 0 && ` · ${p.openBills} ${t('bill khula')}`}
          </p>
          {(age || p.overLimit) && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              {age && <span className={ageTone(p.oldestDue)}>{age}</span>}
              {p.overLimit && (
                <span className="flex items-center gap-1 font-medium text-red-600">
                  <TriangleAlert size={11} /> {t('hadd paar')}
                </span>
              )}
            </p>
          )}
        </button>

        <div className="shrink-0 text-right">
          <p className="tabular text-base font-semibold text-amber-700">{formatMoney(p.amount)}</p>
          <div className="mt-1.5 flex items-center justify-end gap-1">
            {p.phone && (
              <>
                <a href={`tel:${p.phone}`} aria-label={t('Phone karein')} title={t('Phone karein')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-ring">
                  <Phone size={15} />
                </a>
                <a href={waLink(msg, p.phone)} target="_blank" rel="noreferrer"
                  aria-label={t('WhatsApp pe yaad dilayein')} title={t('WhatsApp pe yaad dilayein')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 focus-ring">
                  <MessageCircle size={15} />
                </a>
              </>
            )}
            <button type="button" onClick={onRemind}
              aria-label={t('App me yaad dilayein')} title={t('App me yaad dilayein')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-ring">
              <Clock size={15} />
            </button>
            <Button size="sm" variant="success" onClick={onCollect}>{t('Paisa aaya')}</Button>
          </div>
        </div>
      </div>
    </li>
  );
}

/* ══════════════════════════ 2. Jama paisa ══════════════════════════ */

/**
 * JINKA PAISA AAPKE PAAS PADA HAI.
 *
 * Ye list poore app me kahin thi hi nahi. Har jagah "baaki kitna hai" wali
 * chhalni lagti thi (`balance > 0`), isliye jama wali party har list se
 * chup-chaap gir jati thi — Khata se bhi, Payment se bhi. Dukaandaar ko pata
 * hi nahi chalta tha ki uske golak me kiska kitna paisa pada hai, jab tak wo
 * khud maangne na aa jaye.
 *
 * Yahin se wapas bhi kiya ja sakta hai — ek tap me.
 */
function JamaList({ onRefund, onOpen }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [page, setPage] = useState(1);

  const params = { q: debouncedQ, filter: 'advance', sort: '-balance', page, limit: 20 };
  const { rows, meta, loading } = useListQuery(
    ['khata', 'due', params],
    () => api.get('/khata/due', { params }),
    { onError: (err) => toast.error(err.message) },
  );

  useEffect(() => { setPage(1); }, [debouncedQ]);

  return (
    <>
      <Card className="mb-4 mt-4" padding={false}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Naam ya number...')}
            className="w-full sm:w-56" />
        </div>
      </Card>

      <Card padding={false}>
        {!loading && rows.length > 0 && (
          <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              {meta.total} {t('graahak ka paisa jama hai')}
            </p>
            <p className="tabular text-base font-semibold text-brand-700">
              {formatMoney(meta.totalDue || 0)}
            </p>
          </div>
        )}

        {loading ? <SkeletonRows /> : !rows.length ? (
          <EmptyState
            icon={PiggyBank}
            title={t('Kisi ka paisa jama nahi hai')}
            message={t('Jab koi udhaar se zyada paisa dega, wo yahan jama dikhega.')}
          />
        ) : (
          <>
            <ul>
              {rows.map((p) => (
                <li key={p._id} className="border-b border-slate-100 last:border-0">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button onClick={() => onOpen(p)} className="min-w-0 flex-1 rounded text-left focus-ring">
                      <p className="truncate text-sm font-medium text-slate-900">{p.shopName || p.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {p.phone ? formatPhone(p.phone) : t('number nahi hai')}
                      </p>
                    </button>
                    <div className="shrink-0 text-right">
                      {/* `amount` — hamesha plus me. `balance` khate ka sach hai
                          (jama wale ka minus me), aur wo "Wapas karein" wale
                          parde ko chahiye, dikhane ko nahi. */}
                      <p className="tabular text-base font-semibold text-brand-700">{formatMoney(p.amount)}</p>
                      <Button className="mt-1.5" size="sm" variant="secondary" onClick={() => onRefund(p)}>
                        {t('Wapas karein')}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} showTotal={false} />
          </>
        )}
      </Card>
    </>
  );
}

/* ══════════════════════════ 3. History ══════════════════════════ */

function History({ searchParams, setSearchParams, onReject, onDelete, onConfirm, busy, navigate }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [direction, setDirection] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const params = {
    q: debouncedQ, status, direction,
    from: from || undefined, to: to || undefined, page, limit: 25,
  };
  const { rows, meta, loading } = useListQuery(
    ['payments', params],
    () => api.get('/payments', { params }),
    { onError: (err) => toast.error(err.message) },
  );

  useEffect(() => { setPage(1); }, [debouncedQ, status, direction, from, to]);

  const columns = useMemo(() => [
    {
      key: 'paymentNo', header: t('Payment'),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.paymentNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.date)}</p>
        </div>
      ),
    },
    {
      key: 'party', header: t('Party'),
      render: (r) => (
        <button
          onClick={() => navigate(`${r.party?.type === 'supplier' ? '/suppliers' : '/retailers'}/${r.partyId}?tab=khata`)}
          className="text-left text-brand-700 underline-offset-2 hover:underline"
        >
          {r.party?.name || '—'}
        </button>
      ),
    },
    {
      key: 'mode', header: t('Kaise'),
      render: (r) => {
        const Icon = MODE_ICON[r.mode] || Banknote;
        return (
          <span className="flex items-center gap-1.5 text-slate-600">
            <Icon size={14} /> {r.mode}
            {r.reference && <span className="text-xs text-slate-400">· {r.reference}</span>}
          </span>
        );
      },
    },
    {
      key: 'amount', header: t('Amount'), align: 'right',
      render: (r) => (
        <span className={cn('font-medium', r.direction === 'IN' ? 'text-emerald-700' : 'text-red-600')}>
          {r.direction === 'IN' ? '+' : '−'}{formatMoney(r.amount)}
        </span>
      ),
    },
    {
      key: 'status', header: t('Status'),
      render: (r) => <Badge tone={statusTone[r.status]}>{t(statusLabel[r.status])}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {r.status === 'pending' && (
            <>
              <button onClick={() => onConfirm(r)} disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                aria-label={`${r.paymentNo} confirm karein`}>
                <Check size={16} />
              </button>
              <button onClick={() => onReject(r)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                aria-label={`${r.paymentNo} reject karein`}>
                <X size={16} />
              </button>
            </>
          )}
          <button onClick={() => onDelete(r)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600"
            aria-label={`${r.paymentNo} delete karein`}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], [busy, navigate, onConfirm, onDelete, onReject]);

  return (
    <>
      <Card className="mb-4 mt-4" padding={false}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Payment no, party, UTR...')}
            className="w-full sm:w-56" />
          <Chips value={status}
            onChange={(v) => { setStatus(v); setSearchParams(v === 'all' ? {} : { status: v }); }}
            options={[
              { value: 'all', label: t('Sab') },
              { value: 'pending', label: t('Pending') },
              { value: 'confirmed', label: t('Confirm') },
              { value: 'failed', label: t('Reject') },
            ]} />
          <Chips value={direction} onChange={setDirection}
            options={[
              { value: 'all', label: t('Dono') },
              { value: 'IN', label: t('Aaya') },
              { value: 'OUT', label: t('Diya') },
            ]} />
          <div className="w-36">
            <Input type="date" aria-label={t('Kis din se')} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-36">
            <Input type="date" aria-label={t('Kis din tak')} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !rows.length ? (
          <EmptyState
            icon={Wallet}
            title={t('Abhi koi payment nahi')}
            message={t('Retailer se paisa mile ya supplier ko dein — yahin entry karein, khata apne aap update ho jayega.')}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table columns={columns} rows={rows} loading={loading} />
            </div>
            <div className="md:hidden">
              {loading ? <SkeletonRows />
                : rows.map((r) => {
                  const Icon = MODE_ICON[r.mode] || Banknote;
                  return (
                    <div key={r._id} className="border-b border-slate-100 p-4 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{r.party?.name || r.paymentNo}</p>
                          <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                            <Icon size={11} /> {r.paymentNo} · {formatDate(r.date)}
                          </p>
                          <div className="mt-1.5">
                            <Badge tone={statusTone[r.status]}>{t(statusLabel[r.status])}</Badge>
                          </div>
                        </div>
                        <span className={cn('tabular shrink-0 font-semibold',
                          r.direction === 'IN' ? 'text-emerald-700' : 'text-red-600')}>
                          {r.direction === 'IN' ? '+' : '−'}{formatMoney(r.amount)}
                        </span>
                      </div>
                      {r.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="success" onClick={() => onConfirm(r)} loading={busy}>{t('Mil gaya')}</Button>
                          <Button size="sm" variant="secondary" onClick={() => onReject(r)}>{t('Nahi mila')}</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
