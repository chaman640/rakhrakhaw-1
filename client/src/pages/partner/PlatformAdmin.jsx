import { useCallback, useEffect, useState } from 'react';
import {
  Users, Store, IndianRupee, Clock, AlertTriangle, Search, ArrowLeft, Ban, Check,
  Plus, Trash2, Save, Megaphone, CalendarPlus, Crown, RefreshCw,
} from 'lucide-react';
import api from './partnerApi';

/*
  ADMIN PANEL — PLATFORM KA HISSA (PartnerAdmin.jsx ke tab).

  Sab kuch `/api/partner/admin/platform/*` se. Admin kisi dukaan ka bill,
  khata ya stock nahi chhoota — sirf plan, trial, paisa, feature aur soochna.
  Har badlav server pe register (AdminAudit) me jata hai.
*/

const P = '/admin/platform';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');
const dtt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

const STATUS = {
  trial: ['Trial', 'bg-sky-100 text-sky-800'],
  active: ['Chalu', 'bg-emerald-100 text-emerald-800'],
  grace: ['Mohlat', 'bg-amber-100 text-amber-800'],
  expired: ['Khatam', 'bg-red-100 text-red-800'],
  cancelled: ['Band', 'bg-slate-200 text-slate-700'],
  none: ['Koi plan nahi', 'bg-slate-100 text-slate-600'],
};
const Pill = ({ s }) => {
  const [label, cls] = STATUS[s] || [s, 'bg-slate-100 text-slate-600'];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
};

const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>
);
const Stat = ({ label, value, sub, icon: Icon, tone = 'text-slate-900' }) => (
  <Card>
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {Icon && <Icon size={16} className="text-slate-400" />}
    </div>
    <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    {sub && <p className="text-xs text-slate-500">{sub}</p>}
  </Card>
);
const Btn = ({ children, onClick, tone = 'dark', type = 'button', disabled, small }) => {
  const cls = {
    dark: 'bg-slate-900 text-white hover:bg-slate-800',
    light: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    red: 'bg-red-600 text-white hover:bg-red-700',
    green: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-50 ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm'} ${cls}`}>
      {children}
    </button>
  );
};
const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';

function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setErr(''); setData(await fn()); } catch (e) { setErr(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, err, load, setData };
}

const Err = ({ msg }) => (msg ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p> : null);

function Pager({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="text-slate-500">{meta.total} me se page {meta.page}/{meta.totalPages}</span>
      <Btn small tone="light" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Pichhla</Btn>
      <Btn small tone="light" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Agla</Btn>
    </div>
  );
}

/* ═══════════════════════════════ DASHBOARD ═══════════════════════════════ */

const RANGES = [['today', 'Aaj'], ['yesterday', 'Kal'], ['7d', '7 din'], ['month', 'Is mahine'], ['lastmonth', 'Pichhla mahina'], ['30d', '30 din'], ['custom', 'Apni tareekh']];

export function AdminDashboard({ go }) {
  const [range, setRange] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data: d, err, load } = useLoad(
    () => api.get(`${P}/dashboard`, { params: { range, ...(range === 'custom' ? { from, to } : {}) } }).then((r) => r.data),
    [range, from, to],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setRange(v)}
            className={`rounded-full px-3 py-1 text-sm ${range === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          </>
        )}
        <button type="button" onClick={load} className="ml-auto text-slate-500"><RefreshCw size={16} /></button>
      </div>
      <Err msg={err} />
      {!d ? <p className="text-sm text-slate-500">Load ho raha hai...</p> : (
        <>
          {d.billingMode === 'free' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Abhi BILLING_MODE=free hai — koi paisa nahi liya ja raha. Trial ki tareekh phir bhi likhi ja rahi hai.
            </p>
          )}
          {d.revenue && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Aaj ki kamai" value={inr(d.revenue.today.rupees)} sub={`${d.revenue.today.count} payment`} icon={IndianRupee} tone="text-emerald-700" />
            <Stat label="Is mahine" value={inr(d.revenue.month.rupees)} sub={`${d.revenue.month.count} payment`} icon={IndianRupee} />
            <Stat label="Chuni hui avdhi" value={inr(d.revenue.range.rupees)} sub={`Fail: ${d.revenue.failedInRange} · Refund: ${d.revenue.refunded}`} icon={IndianRupee} />
            <Stat label="Kul kamai" value={inr(d.revenue.total.rupees)} icon={IndianRupee} />
          </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sellers" value={d.users.sellers} sub={`+${d.users.newSellers} naye`} icon={Store} />
            <Stat label="Buyers / Retailers" value={d.users.buyers} sub={`+${d.users.newBuyers} naye`} icon={Users} />
            <Stat label="Staff" value={d.users.staff} sub={`Band account: ${d.users.inactive}`} icon={Users} />
            <Stat label="Dukaanein" value={d.businesses.active} sub={`Suspend: ${d.businesses.suspended}`} icon={Store} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Trial chalu" value={d.trials.active} sub={`3 din me khatam: ${d.trials.endingSoon}`} icon={Clock} tone="text-sky-700" />
            <Stat label="Trial → Paid" value={d.trials.conversionRate === null ? '—' : `${d.trials.conversionRate}%`} sub={`${d.trials.converted} ne liya · ${d.trials.expired} chhod gaye`} icon={Crown} />
            <Stat label="Paid chalu" value={d.subscriptions.paidActive} sub={`7 din me renew: ${d.subscriptions.renewSoon}`} icon={Check} tone="text-emerald-700" />
            <Stat label="Mohlat / Khatam" value={`${d.subscriptions.grace} / ${d.subscriptions.expired}`} sub={`Renew band: ${d.subscriptions.cancelling}`} icon={AlertTriangle} tone="text-amber-700" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-2 text-sm font-semibold text-slate-900">Plan ke hisaab se</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Plan</th><th>Trial</th><th>Mahina</th><th>Saal</th></tr></thead>
                <tbody>
                  {d.subscriptions.byPlan.map((p) => (
                    <tr key={p.code} className="border-t border-slate-100">
                      <td className="py-1.5">{p.name} <span className="text-xs text-slate-400">₹{p.priceRupees}</span></td>
                      <td>{p.trial}</td><td>{p.paidMonthly}</td><td>{p.paidYearly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                Videos: {d.content.videos} (lagi hui {d.content.publishedVideos}, baaki {d.content.draftVideos})
                {d.support && <> · Support: {d.support.open} khule{d.support.urgent ? `, ${d.support.urgent} zaroori` : ''}</>}
              </p>
            </Card>
            <Card>
              <p className="mb-2 text-sm font-semibold text-slate-900">Nayi dukaanein</p>
              <ul className="divide-y divide-slate-100 text-sm">
                {d.recentBusinesses.map((b) => (
                  <li key={b._id} className="flex items-center justify-between py-1.5">
                    <button type="button" className="text-left hover:underline" onClick={() => go('businesses', b._id)}>{b.name}</button>
                    <span className="text-xs text-slate-500">{b.phone} · {dt(b.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-2 mt-4 text-sm font-semibold text-slate-900">Haal ke admin kaam</p>
              <ul className="space-y-1 text-xs text-slate-600">
                {d.recentAdminActions.map((a) => (
                  <li key={a._id}>{dtt(a.createdAt)} · <b>{a.action}</b> {a.targetLabel && `· ${a.targetLabel}`}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════ DUKAANEIN ═══════════════════════════════ */

const BIZ_STATUS = [['', 'Sab'], ['trial', 'Trial'], ['trial_expired', 'Trial khatam'], ['active', 'Paid chalu'], ['grace', 'Mohlat'], ['expired', 'Khatam'], ['cancelling', 'Renew band'], ['none', 'Koi plan nahi']];

export function AdminBusinesses({ openId, plans }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [suspended, setSuspended] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(openId || null);
  useEffect(() => { if (openId) setOpen(openId); }, [openId]);

  const { data, err } = useLoad(
    () => api.get(`${P}/businesses`, { params: { q, status, plan, suspended, page } }).then((r) => r.data),
    [q, status, plan, suspended, page],
  );

  if (open) return <BusinessOne id={open} plans={plans} onBack={() => setOpen(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Naam, phone, dukaan ya ID"
            className={`${input} w-full pl-9`} />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={input}>
          {BIZ_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className={input}>
          <option value="">Sab plan</option>
          {(plans || []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <select value={suspended} onChange={(e) => { setSuspended(e.target.value); setPage(1); }} className={input}>
          <option value="">Chalu + band</option><option value="no">Sirf chalu</option><option value="yes">Sirf band (suspend)</option>
        </select>
      </div>
      <Err msg={err} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="px-3 py-2">Dukaan</th><th>Malik</th><th>Plan</th><th>Haal</th><th>Kab tak</th><th>Aakhri login</th><th>Judi</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((b) => (
              <tr key={b._id} onClick={() => setOpen(b._id)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{b.name} {b.suspended && <span className="ml-1 rounded bg-red-100 px-1.5 text-xs text-red-700">Suspend</span>}</p>
                  <p className="text-xs text-slate-500">{b.phone}{b.city && ` · ${b.city}`}</p>
                </td>
                <td>{b.ownerName}<p className="text-xs text-slate-500">{b.ownerPhone}</p></td>
                <td>{b.subscription.planName}{b.subscription.period === 'yearly' && <span className="text-xs text-slate-500"> (saal)</span>}</td>
                <td><Pill s={b.subscription.status} /></td>
                <td>{dt(b.subscription.paidTill)}</td>
                <td className="text-xs">{dtt(b.lastLoginAt)}</td>
                <td className="text-xs">{dt(b.createdAt)}</td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Kuch nahi mila</td></tr>}
          </tbody>
        </table>
      </Card>
      <Pager meta={data?.meta} onPage={setPage} />
    </div>
  );
}

function BusinessOne({ id, plans, onBack }) {
  const { data: d, err, setData } = useLoad(() => api.get(`${P}/businesses/${id}`).then((r) => r.data), [id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [days, setDays] = useState('7');
  const [planCode, setPlanCode] = useState('');
  const [planDays, setPlanDays] = useState('30');
  const [note, setNote] = useState('');

  async function act(path, body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setMsg('');
    try {
      const r = await api.post(`${P}/businesses/${id}/${path}`, { ...body, note });
      setData(r.data);
      setMsg(r.data?.warning ? `${r.message}. ${r.data.warning}` : r.message);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  if (!d) return <div><button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm"><ArrowLeft size={15} />Wapas</button><Err msg={err} /></div>;
  const s = d.subscription;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-slate-600"><ArrowLeft size={15} />Sab dukaanein</button>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold text-slate-900">{d.business.name}</p>
              <p className="text-sm text-slate-500">{d.business.phone} · {d.business.address?.city || '—'} · GST: {d.business.gstin || '—'}</p>
              <p className="text-sm text-slate-500">Malik: {d.owner?.name} ({d.owner?.phone}) · Aakhri login {dtt(d.owner?.lastLoginAt)}</p>
              <p className="text-xs text-slate-400">Judi {dt(d.business.createdAt)} · ID {d.business._id}</p>
            </div>
            {d.business.suspended
              ? <span className="rounded bg-red-100 px-2 py-1 text-sm text-red-800">Suspend: {d.business.suspendReason || '—'}</span>
              : <span className="rounded bg-emerald-100 px-2 py-1 text-sm text-emerald-800">Chalu</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Plan" value={s.planName} sub={s.period === 'yearly' ? 'Saal' : 'Mahina'} />
            <Stat label="Haal" value={<Pill s={s.status} />} sub={s.autoRenew ? `Autopay: ${s.mandateStatus || '—'}` : 'Renew band'} />
            <Stat label="Kab tak" value={dt(s.paidTill)} sub={s.isTrial ? `Trial ${dt(s.trialEndsAt)} tak` : ''} />
            <Stat label="Upyog" value={`${d.usage.items} item`} sub={`${d.usage.invoices} bill · ${d.staffCount} staff`} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Chalu feature: {d.enabledFeatures.join(', ') || '—'}</p>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Admin ke kaam</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wajah / note (register me jayega)" className={`${input} w-full`} />
          <div className="flex gap-2">
            <input type="number" min="1" max="366" value={days} onChange={(e) => setDays(e.target.value)} className={`${input} w-20`} />
            <Btn disabled={busy} onClick={() => act('extend', { days: Number(days) }, `${days} din badhayein?`)}>
              <CalendarPlus size={14} />{s.isTrial ? 'Trial badhayein' : 'Din badhayein'}
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={input}>
              <option value="">Plan chunein</option>
              {(plans || []).map((p) => <option key={p.code} value={p.code}>{p.name} (₹{p.priceRupees})</option>)}
            </select>
            <input type="number" min="0" max="366" value={planDays} onChange={(e) => setPlanDays(e.target.value)} className={`${input} w-20`} title="Saath me kitne din" />
            <Btn disabled={busy || !planCode} onClick={() => act('plan', { planCode, days: Number(planDays) }, 'Plan badlein? (paisa nahi katega)')}>
              <Crown size={14} />Plan dein
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.autoRenew && s.status !== 'none' && (
              <Btn tone="light" disabled={busy} onClick={() => act('cancel', {}, 'Is dukaan ka autopay/renew band karein?')}>Renew band karein</Btn>
            )}
            {d.business.suspended ? (
              <Btn tone="green" disabled={busy} onClick={() => act('suspend', { suspended: false }, 'Dukaan dobara chalu karein?')}><Check size={14} />Chalu karein</Btn>
            ) : (
              <Btn tone="red" disabled={busy || !note.trim()} onClick={() => act('suspend', { suspended: true, reason: note }, 'Dukaan suspend karein? Bechna turant band hoga.')}><Ban size={14} />Suspend</Btn>
            )}
          </div>
          {!d.business.suspended && !note.trim() && <p className="text-xs text-slate-500">Suspend ke liye upar wajah likhein.</p>}
          {msg && <p className="rounded bg-slate-100 px-2 py-1.5 text-sm text-slate-800">{msg}</p>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-semibold">Payments</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {d.payments.map((p) => (
              <li key={p._id} className="flex justify-between py-1.5">
                <span>{p.planName} · {p.months >= 12 ? 'saal' : `${p.months} mahina`}<span className="block text-xs text-slate-500">{dt(p.paidAt || p.createdAt)} · {p.receiptNo || p.providerPaymentId || '—'}</span></span>
                <span className="text-right">{inr(p.amountRupees)}<span className="block text-xs">{p.status}</span></span>
              </li>
            ))}
            {!d.payments.length && <li className="py-2 text-slate-500">Koi payment nahi</li>}
          </ul>
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Staff ({d.staffCount})</p>
          <ul className="text-sm">
            {d.staff.map((u) => <li key={u._id} className="py-1">{u.name} · {u.phone} · {u.staffRole}{!u.isActive && ' (band)'}</li>)}
            {!d.staff.length && <li className="text-slate-500">Koi staff nahi</li>}
          </ul>
          <p className="mb-2 mt-4 text-sm font-semibold">Is dukaan pe admin ke kaam</p>
          <ul className="space-y-1 text-xs text-slate-600">
            {d.adminActions.map((a) => <li key={a._id}>{dtt(a.createdAt)} · <b>{a.action}</b> {a.note && `· ${a.note}`}</li>)}
            {!d.adminActions.length && <li>—</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ USERS ═══════════════════════════════ */

export function AdminUsers() {
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const { data, err } = useLoad(() => api.get(`${P}/users`, { params: { type, q, active, page } }).then((r) => r.data), [type, q, active, page]);
  const TYPES = [['all', 'All'], ['seller', 'Sellers'], ['buyer', 'Buyers / retailers'], ['staff', 'Staff'], ['employee', 'Employees']];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TYPES.map(([v, l]) => (
          <button key={v} type="button" onClick={() => { setType(v); setPage(1); }}
            className={`rounded-full px-3 py-1 text-sm ${type === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Naam ya phone" className={`${input} min-w-[200px] flex-1`} />
        <select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className={input}>
          <option value="">Chalu + band</option><option value="yes">Chalu</option><option value="no">Band</option>
        </select>
      </div>
      <Err msg={err} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="px-3 py-2">Naam</th><th>Phone</th><th>Kaun</th><th>Dukaan</th><th>Aakhri login</th><th>Juda</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((u) => (
              <tr key={u._id} className="border-t border-slate-100">
                <td className="px-3 py-2">{u.name}{!u.active && <span className="ml-1 text-xs text-red-600">(band)</span>}</td>
                <td>{u.phone}</td>
                <td>{u.type === 'staff' ? `Staff · ${u.staffRole}` : u.type === 'employee' ? 'Employee' : u.type === 'buyer' ? 'Buyer' : 'Seller'}</td>
                <td>{u.businessName || '—'}</td>
                <td className="text-xs">{dtt(u.lastLoginAt)}</td>
                <td className="text-xs">{dt(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pager meta={data?.meta} onPage={setPage} />
    </div>
  );
}

/* ═══════════════════════════════ PAYMENTS ═══════════════════════════════ */

export function AdminPayments() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, err } = useLoad(() => api.get(`${P}/payments`, { params: { status, q, page } }).then((r) => r.data), [status, q, page]);
  const LABEL = { paid: 'Mil gaya', created: 'Adhoora', failed: 'Fail', refunded: 'Wapas' };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[['', 'Sab'], ['paid', 'Mil gaya'], ['created', 'Adhoora'], ['failed', 'Fail'], ['refunded', 'Wapas']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => { setStatus(v); setPage(1); }}
            className={`rounded-full px-3 py-1 text-sm ${status === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {l}{data?.totals?.[v] ? ` · ${inr(data.totals[v].rupees)}` : ''}
          </button>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Dukaan, phone, payment ID ya rasid" className={`${input} min-w-[220px] flex-1`} />
      </div>
      <p className="text-xs text-slate-500">Card/UPI ki detail hamare paas kabhi nahi aati — sirf Razorpay ka payment ID.</p>
      <Err msg={err} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="px-3 py-2">Tareekh</th><th>Dukaan</th><th>Plan</th><th>Rakam</th><th>Haal</th><th>Payment ID / Rasid</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs">{dtt(p.paidAt || p.createdAt)}</td>
                <td>{p.businessName}<p className="text-xs text-slate-500">{p.businessPhone}</p></td>
                <td>{p.planName} · {p.period === 'yearly' ? 'saal' : `${p.months} mahina`}</td>
                <td className="font-medium">{inr(p.amountRupees)}</td>
                <td>{LABEL[p.status] || p.status}{p.failReason && <p className="text-xs text-red-600">{p.failReason}</p>}</td>
                <td className="text-xs">{p.paymentId || '—'}<p className="text-slate-500">{p.receiptNo}</p></td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Koi payment nahi</td></tr>}
          </tbody>
        </table>
      </Card>
      <Pager meta={data?.meta} onPage={setPage} />
    </div>
  );
}

/* ═══════════════════════════════ PLANS & FEATURES ═══════════════════════════════ */

export function AdminPlans({ onChanged }) {
  const { data, err, load } = useLoad(() => api.get(`${P}/plans`).then((r) => r.data), []);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      trialDays: data.trialDays,
      trialPlanCode: data.trialPlanCode,
      supportPhone: data.supportPhone,
      supportEmail: data.supportEmail,
      plans: data.plans.map((p) => ({ ...p, featuresText: (p.features || []).join('\n') })),
      featurePlans: Object.fromEntries(data.features.map((f) => [f.key, f.plans])),
      featureOff: data.features.filter((f) => f.off).map((f) => f.key),
      featureLimits: Object.fromEntries((data.limits || []).map((l) => [l.key, { ...l.values }])),
    });
  }, [data]);

  if (!form) return <><Err msg={err} /><p className="text-sm text-slate-500">Load ho raha hai...</p></>;

  const setPlan = (code, patch) => setForm((f) => ({ ...f, plans: f.plans.map((p) => (p.code === code ? { ...p, ...patch } : p)) }));
  const toggleFP = (key, code) => setForm((f) => {
    const cur = f.featurePlans[key] || [];
    return { ...f, featurePlans: { ...f.featurePlans, [key]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] } };
  });

  async function save() {
    if (!window.confirm('Setting save karein? Naye daam naye mandate/checkout pe lagenge; purane grahak apne daam pe chalte rahenge.')) return;
    setBusy(true); setMsg('');
    try {
      const r = await api.put(`${P}/plans`, {
        trialDays: Number(form.trialDays),
        trialPlanCode: form.trialPlanCode,
        supportPhone: form.supportPhone,
        supportEmail: form.supportEmail,
        plans: form.plans.map((p) => ({
          code: p.code, name: p.name, priceRupees: Number(p.priceRupees),
          seats: p.unlimited ? undefined : Number(p.seats), unlimited: Boolean(p.unlimited),
          tagline: p.tagline || '', features: p.featuresText.split('\n').map((x) => x.trim()).filter(Boolean),
          active: p.active,
        })),
        featurePlans: form.featurePlans,
        featureOff: form.featureOff,
        featureLimits: Object.fromEntries(Object.entries(form.featureLimits || {}).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([c, n]) => [c, n === '' || n === null ? null : Number(n)]))])),
      });
      setMsg(r.message);
      await load();
      onChanged?.();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Free trial (din)
          <input type="number" min="0" max="90" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} className={`${input} mt-1 w-full`} />
        </label>
        <label className="text-sm">Trial kis plan pe
          <select value={form.trialPlanCode} onChange={(e) => setForm({ ...form, trialPlanCode: e.target.value })} className={`${input} mt-1 w-full`}>
            {form.plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Support phone
          <input value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} className={`${input} mt-1 w-full`} />
        </label>
        <label className="text-sm">Support email
          <input value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={`${input} mt-1 w-full`} />
        </label>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {form.plans.map((p) => (
          <Card key={p.code} className={p.active ? '' : 'opacity-70'}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">{p.code}</p>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={p.active} onChange={(e) => setPlan(p.code, { active: e.target.checked })} />Naye grahak le sakein</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={p.name} onChange={(e) => setPlan(p.code, { name: e.target.value })} className={input} placeholder="Naam" />
              <input type="number" min="1" value={p.priceRupees} onChange={(e) => setPlan(p.code, { priceRupees: e.target.value })} className={input} placeholder="₹ / mahina" />
              <input type="number" min="1" disabled={p.unlimited} value={p.unlimited ? '' : (p.seats || '')} onChange={(e) => setPlan(p.code, { seats: e.target.value })} className={input} placeholder="Kitne account" />
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={p.unlimited} onChange={(e) => setPlan(p.code, { unlimited: e.target.checked })} />Jitne chahein</label>
            </div>
            <input value={p.tagline || ''} onChange={(e) => setPlan(p.code, { tagline: e.target.value })} className={`${input} mt-2 w-full`} placeholder="Ek line" />
            <textarea rows={3} value={p.featuresText} onChange={(e) => setPlan(p.code, { featuresText: e.target.value })} className={`${input} mt-2 w-full`} placeholder="Plan card ki lines (har line alag)" />
            <p className="mt-1 text-xs text-slate-500">Saal ka daam: {inr(Number(p.priceRupees || 0) * (p.yearlyRupees && p.priceRupees ? p.yearlyRupees / p.priceRupees : 12))}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <p className="mb-1 text-sm font-semibold">Kaunsa feature kis plan me</p>
        <p className="mb-3 text-xs text-slate-500">Backend pe bhi yahi lagta hai — sirf button chhupana nahi. Hisaab-kitaab (bill, khata, GST) har plan me hamesha chalu hai.</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Feature</th>{form.plans.map((p) => <th key={p.code} className="text-center">{p.name}</th>)}<th className="text-center">Poora band</th></tr></thead>
          <tbody>
            {data.features.map((f) => (
              <tr key={f.key} className="border-t border-slate-100">
                <td className="py-2">{f.name}<p className="text-xs text-slate-500">{f.key} · {f.desc}</p></td>
                {form.plans.map((p) => (
                  <td key={p.code} className="text-center">
                    <input type="checkbox" checked={(form.featurePlans[f.key] || []).includes(p.code)} onChange={() => toggleFP(f.key, p.code)} />
                  </td>
                ))}
                <td className="text-center">
                  <input type="checkbox" checked={form.featureOff.includes(f.key)}
                    onChange={(e) => setForm((x) => ({ ...x, featureOff: e.target.checked ? [...x.featureOff, f.key] : x.featureOff.filter((k) => k !== f.key) }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {(data.limits || []).length > 0 && (
        <Card className="overflow-x-auto">
          <p className="mb-1 text-sm font-semibold">Limits inside features</p>
          <p className="mb-3 text-xs text-slate-500">Leave empty for no limit.</p>
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Limit</th>{form.plans.map((p) => <th key={p.code} className="text-center">{p.name}</th>)}</tr></thead>
            <tbody>
              {data.limits.map((l) => (
                <tr key={l.key} className="border-t border-slate-100">
                  <td className="py-2">{l.name}<p className="text-xs text-slate-500">{l.key}</p></td>
                  {form.plans.map((p) => (
                    <td key={p.code} className="px-1 text-center">
                      <input type="number" min="0" aria-label={`${l.name} — ${p.name}`} value={form.featureLimits?.[l.key]?.[p.code] ?? ''}
                        onChange={(e) => setForm((x) => ({ ...x, featureLimits: { ...x.featureLimits, [l.key]: { ...x.featureLimits[l.key], [p.code]: e.target.value } } }))}
                        placeholder="∞" className={`${input} w-20 text-center`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Btn disabled={busy} onClick={save}><Save size={14} />Save karein</Btn>
        {msg && <span className="text-sm text-slate-700">{msg}</span>}
        {data.updatedAt && <span className="ml-auto text-xs text-slate-400">Aakhri badlav {dtt(data.updatedAt)}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ SOOCHNA ═══════════════════════════════ */

const blankAnn = { title: '', body: '', link: '', tone: 'info', audience: 'all', planCodes: [], businessIds: [], channels: ['banner'], startsAt: '', endsAt: '', active: true };
const AUDIENCE = { all: 'Everyone', sellers: 'Sellers (shop owners & staff)', buyers: 'Buyers / retailers', employees: 'Employees (Employee App)', specific: 'Specific businesses' };

function BusinessPicker({ ids, names, onChange }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => api.get(`${P}/businesses`, { params: { q, page: 1 } }).then((r) => setFound(r.data?.rows || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{names[id] || id.slice(-6)}
            <button type="button" aria-label="Remove" onClick={() => onChange(ids.filter((x) => x !== id), names)}>×</button></span>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business by name or phone" className={`${input} w-full`} />
      {found.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 text-sm">
          {found.filter((b) => !ids.includes(b._id)).map((b) => (
            <li key={b._id}><button type="button" onClick={() => { onChange([...ids, b._id], { ...names, [b._id]: b.name }); setQ(''); }} className="w-full px-3 py-1.5 text-left hover:bg-slate-50">{b.name} <span className="text-xs text-slate-500">{b.phone || b.ownerPhone || ''}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function AdminAnnouncements({ plans }) {
  const { data, err, load } = useLoad(() => api.get(`${P}/announcements`).then((r) => r.data), []);
  const [f, setF] = useState(blankAnn);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');
  const [bizNames, setBizNames] = useState({});

  async function save(e) {
    e.preventDefault(); setMsg('');
    const body = { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null };
    try {
      const r = editId ? await api.put(`${P}/announcements/${editId}`, body) : await api.post(`${P}/announcements`, body);
      setMsg(r.message); setF(blankAnn); setEditId(null); load();
    } catch (e2) { setMsg(e2.message); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this announcement?')) return;
    try { await api.delete(`${P}/announcements/${id}`); load(); } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Megaphone size={15} />{editId ? 'Edit announcement' : 'New announcement'}</p>
        <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title" className={`${input} w-full`} />
        <textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Message" className={`${input} w-full`} />
        <input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="Link (optional) — e.g. /profile?tab=plan" className={`${input} w-full`} />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Audience" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} className={input}>
            {Object.entries(AUDIENCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} className={input}>
            <option value="info">Information</option><option value="success">Good news</option><option value="warning">Warning</option>
          </select>
          <label className="text-xs text-slate-600">Starts<input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={`${input} w-full`} /></label>
          <label className="text-xs text-slate-600">Ends (optional)<input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={`${input} w-full`} /></label>
        </div>
        {f.audience === 'specific' && <BusinessPicker ids={f.businessIds || []} names={bizNames} onChange={(ids, n) => { setBizNames(n); setF({ ...f, businessIds: ids }); }} />}
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-xs text-slate-500">Show as:</span>
          {[['banner', 'Banner on dashboard / web / app'], ['notification', 'Notification']].map(([c, l]) => (
            <label key={c} className="flex items-center gap-1">
              <input type="checkbox" checked={(f.channels || []).includes(c)}
                onChange={(e) => { const next = e.target.checked ? [...(f.channels || []), c] : (f.channels || []).filter((x) => x !== c); if (next.length) setF({ ...f, channels: next }); }} />{l}
            </label>
          ))}
        </div>
        {!['buyers', 'specific'].includes(f.audience) && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-xs text-slate-500">Only sellers on these plans (none = all):</span>
            {(plans || []).map((p) => (
              <label key={p.code} className="flex items-center gap-1">
                <input type="checkbox" checked={f.planCodes.includes(p.code)}
                  onChange={(e) => setF({ ...f, planCodes: e.target.checked ? [...f.planCodes, p.code] : f.planCodes.filter((c) => c !== p.code) })} />{p.name}
              </label>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Active</label>
        <div className="flex gap-2">
          <Btn type="submit"><Plus size={14} />{editId ? 'Save' : 'Create'}</Btn>
          {editId && <Btn tone="light" onClick={() => { setEditId(null); setF(blankAnn); }}>Cancel</Btn>}
        </div>
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </form>

      <div className="space-y-2">
        <Err msg={err} />
        {(data || []).map((a) => (
          <Card key={a._id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{a.title} {!a.active && <span className="text-xs text-slate-500">(inactive)</span>}</p>
                <p className="text-sm text-slate-600">{a.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {AUDIENCE[a.audience] || a.audience}{a.audience === 'specific' ? ` (${a.businessIds?.length || 0})` : ''} · {(a.channels || ['banner']).join(' + ')}{a.notifiedAt ? ' · sent' : ''}
                  {a.planCodes?.length ? ` · ${a.planCodes.join(', ')}` : ''} · {dtt(a.startsAt)} → {a.endsAt ? dtt(a.endsAt) : 'no end'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Btn small tone="light" onClick={() => { setEditId(a._id); setF({ ...blankAnn, ...a, startsAt: toLocal(a.startsAt), endsAt: toLocal(a.endsAt) }); }}>Edit</Btn>
                <Btn small tone="light" onClick={() => remove(a._id)}><Trash2 size={12} /></Btn>
              </div>
            </div>
          </Card>
        ))}
        {data && !data.length && <p className="text-sm text-slate-500">No announcements yet.</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ REGISTER ═══════════════════════════════ */

export function AdminAuditLog() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState(null);
  const { data, err } = useLoad(() => api.get(`${P}/audit`, { params: { action, page } }).then((r) => r.data), [action, page]);
  const ACTIONS = [['', 'Sab'], ['admin.', 'Login'], ['business.', 'Suspend/chalu'], ['plan.', 'Plan'], ['trial.', 'Trial'], ['subscription.', 'Subscription'], ['plans.', 'Plans'], ['features.', 'Features'], ['announcement.', 'Soochna']];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(([v, l]) => (
          <button key={v} type="button" onClick={() => { setAction(v); setPage(1); }}
            className={`rounded-full px-3 py-1 text-sm ${action === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Ye register badla ya mitaya nahi ja sakta.</p>
      <Err msg={err} />
      <Card className="p-0">
        <ul className="divide-y divide-slate-100 text-sm">
          {(data?.rows || []).map((a) => (
            <li key={a._id} className="px-3 py-2">
              <button type="button" className="w-full text-left" onClick={() => setOpenRow(openRow === a._id ? null : a._id)}>
                <span className="text-xs text-slate-500">{dtt(a.createdAt)}</span> · <b>{a.action}</b>
                {a.targetLabel && ` · ${a.targetLabel}`} {a.note && <span className="text-slate-500">— {a.note}</span>}
                <span className="block text-xs text-slate-400">{a.adminEmail}</span>
              </button>
              {openRow === a._id && (
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                  <pre className="overflow-auto rounded bg-slate-50 p-2">Pehle: {JSON.stringify(a.before, null, 1)}</pre>
                  <pre className="overflow-auto rounded bg-slate-50 p-2">Baad: {JSON.stringify(a.after, null, 1)}</pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Pager meta={data?.meta} onPage={setPage} />
    </div>
  );
}
