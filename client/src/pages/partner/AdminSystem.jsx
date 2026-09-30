import { useCallback, useEffect, useState } from 'react';
import {
  Bell, Save, Wrench, CheckCheck, Video, HelpCircle, Megaphone, Layers, ToggleRight, LifeBuoy, Users, IndianRupee,
} from 'lucide-react';
import api from './partnerApi';

const P = '/admin/platform';
const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const dtt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

const ALERT_LABEL = {
  new_seller: 'New seller registration', new_subscription: 'New subscription / payment', payment_failed: 'Payment failed', trial_ending: 'Trial ending soon',
  expired: 'Subscription expired', ticket: 'Support ticket created', urgent_ticket: 'Urgent support ticket', suspicious_login: 'Suspicious login',
  system_error: 'System error', content_issue: 'Video / content issue',
};
const SEV = { info: 'bg-sky-50 text-sky-800', warning: 'bg-amber-50 text-amber-800', critical: 'bg-red-50 text-red-800' };

/** Where an alert link points inside the single-page admin panel */
export function alertTarget(link = '') {
  const biz = link.match(/businesses\/([a-f\d]{24})/i);
  if (biz) return ['businesses', biz[1]];
  if (/support/.test(link)) return ['support', null];
  return null;
}

/* ─────────────── alert bell (header) ─────────────── */

export function AlertBell({ onOpen }) {
  const [n, setN] = useState(0);
  const load = useCallback(() => api.get(`${P}/alerts`, { params: { unread: '1' } }).then((r) => setN(r.meta?.unread || 0)).catch(() => {}), []);
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);
  return (
    <button type="button" onClick={onOpen} aria-label={`Alerts${n ? ` (${n} unread)` : ''}`} title="Alerts" className="relative rounded-lg px-2.5 py-2 text-slate-600 hover:bg-slate-100">
      <Bell size={15} />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span>}
    </button>
  );
}

/* ─────────────── alerts feed ─────────────── */

export function AdminAlerts({ go }) {
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setErr(''); setRes(await api.get(`${P}/alerts`, { params: { unread: unread ? '1' : '0', page } })); } catch (e) { setErr(e.message); }
  }, [unread, page]);
  useEffect(() => { load(); }, [load]);
  async function readAll() { await api.post(`${P}/alerts/read`, {}); load(); }
  async function open(a) {
    if (!a.read) await api.post(`${P}/alerts/read`, { ids: [a._id] }).catch(() => {});
    const t = alertTarget(a.link);
    if (t) go(t[0], t[1]); else load();
  }
  const rows = res?.data || [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[[false, 'All'], [true, `Unread${res?.meta?.unread ? ` (${res.meta.unread})` : ''}`]].map(([v, l]) => (
          <button key={l} type="button" onClick={() => { setUnread(v); setPage(1); }} className={`rounded-full px-3 py-1 text-sm ${unread === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
        <button type="button" onClick={readAll} className="ml-auto inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><CheckCheck size={15} />Mark all read</button>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {!rows.length && <p className="p-6 text-center text-sm text-slate-500">No alerts.</p>}
        {rows.map((a) => (
          <button key={a._id} type="button" onClick={() => open(a)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${a.read ? '' : 'bg-slate-50/60'}`}>
            {!a.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">{a.title}</span>
              {a.body && <span className="block text-xs text-slate-500">{a.body}</span>}
              <span className="mt-0.5 block text-xs text-slate-400">{ALERT_LABEL[a.type] || a.type} · {dtt(a.createdAt)}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${SEV[a.severity]}`}>{a.severity}</span>
          </button>
        ))}
      </div>
      {res?.meta?.totalPages > 1 && (
        <div className="flex justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={input}>Previous</button>
          <button type="button" disabled={page >= res.meta.totalPages} onClick={() => setPage(page + 1)} className={input}>Next</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── system settings ─────────────── */

const Field = ({ label, children }) => <label className="block text-sm text-slate-700">{label}<div className="mt-1">{children}</div></label>;

export function AdminSettings() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`${P}/settings`).then((r) => setF({ ...r.data, maintenance: { ...r.data.maintenance, until: toLocal(r.data.maintenance?.until) } })).catch((e) => setMsg(e.message)); }, []);
  if (!f) return <p className="text-sm text-slate-500">{msg || 'Loading…'}</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(extra = {}) {
    setBusy(true); setMsg('');
    try {
      const body = {
        platformName: f.platformName, logoUrl: f.logoUrl, supportPhone: f.supportPhone, supportEmail: f.supportEmail, supportWhatsapp: f.supportWhatsapp,
        defaultLanguage: f.defaultLanguage, tutorialLanguage: f.tutorialLanguage, currency: f.currency, trialDays: Number(f.trialDays), trialPlanCode: f.trialPlanCode,
        notify: f.notify, maintenance: { enabled: f.maintenance.enabled, message: f.maintenance.message || '', until: f.maintenance.until ? new Date(f.maintenance.until).toISOString() : null },
        ...extra,
      };
      const r = await api.put(`${P}/settings`, body);
      setF({ ...r.data, maintenance: { ...r.data.maintenance, until: toLocal(r.data.maintenance?.until) } });
      setMsg(r.message);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function toggleMaintenance() {
    const on = !f.maintenance.enabled;
    if (!window.confirm(on ? 'Turn ON maintenance mode? All shops, buyers and employees will be blocked until you turn it off.' : 'Turn OFF maintenance mode?')) return;
    const m = { ...f.maintenance, enabled: on };
    setF({ ...f, maintenance: m });
    await save({ maintenance: { enabled: on, message: m.message || '', until: m.until ? new Date(m.until).toISOString() : null } });
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${f.maintenance.enabled ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-900"><Wrench size={16} />Maintenance mode {f.maintenance.enabled ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">ON</span> : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">off</span>}</p>
            <p className="text-xs text-slate-600">Users see your message instead of the app. The admin panel keeps working.</p>
          </div>
          <button type="button" disabled={busy} onClick={toggleMaintenance} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${f.maintenance.enabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>{f.maintenance.enabled ? 'Turn off' : 'Turn on'}</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label="Message for users"><input value={f.maintenance.message || ''} onChange={(e) => setF({ ...f, maintenance: { ...f.maintenance, message: e.target.value } })} placeholder="We are upgrading the app. Back by 6 pm." className={`${input} w-full`} /></Field>
          <Field label="Expected back (optional)"><input type="datetime-local" value={f.maintenance.until || ''} onChange={(e) => setF({ ...f, maintenance: { ...f.maintenance, until: e.target.value } })} className={`${input} w-full`} /></Field>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 font-semibold text-slate-900">Platform</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Platform name"><input value={f.platformName} onChange={set('platformName')} className={`${input} w-full`} /></Field>
          <Field label="Logo URL (https://…)"><input value={f.logoUrl} onChange={set('logoUrl')} placeholder="https://…/logo.png" className={`${input} w-full`} /></Field>
          <Field label="Currency"><select value={f.currency} onChange={set('currency')} className={`${input} w-full`}><option value="INR">₹ Indian Rupee (INR)</option></select></Field>
          <Field label="Support phone"><input value={f.supportPhone} onChange={set('supportPhone')} className={`${input} w-full`} /></Field>
          <Field label="Support WhatsApp"><input value={f.supportWhatsapp} onChange={set('supportWhatsapp')} className={`${input} w-full`} /></Field>
          <Field label="Support email"><input value={f.supportEmail} onChange={set('supportEmail')} className={`${input} w-full`} /></Field>
          <Field label="Default app language"><select value={f.defaultLanguage} onChange={set('defaultLanguage')} className={`${input} w-full`}><option value="en">English</option><option value="hi">हिन्दी</option></select></Field>
          <Field label="Default tutorial language"><select value={f.tutorialLanguage} onChange={set('tutorialLanguage')} className={`${input} w-full`}><option value="hi">हिन्दी</option><option value="en">English</option></select></Field>
          <Field label="Free trial (days)"><input type="number" min="0" max="90" value={f.trialDays} onChange={set('trialDays')} className={`${input} w-full`} /></Field>
          <Field label="Trial plan"><select value={f.trialPlanCode} onChange={set('trialPlanCode')} className={`${input} w-full`}>{(f.plans || []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field>
        </div>
        {f.logoUrl && <img src={f.logoUrl} alt="Logo preview" className="mt-3 h-10 w-auto rounded border border-slate-200" />}
        <p className="mt-3 text-xs text-slate-500">API keys and server secrets are not shown or edited here — they stay in the server environment.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-1 font-semibold text-slate-900">Admin alerts</p>
        <p className="mb-3 text-xs text-slate-500">Which events create an alert in the bell. Each admin only sees alerts for areas their role allows.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(ALERT_LABEL).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.notify?.[k] !== false} onChange={(e) => setF({ ...f, notify: { ...f.notify, [k]: e.target.checked } })} />{l}</label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={() => save()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={14} />Save settings</button>
        {msg && <span className="text-sm text-slate-700">{msg}</span>}
      </div>
    </div>
  );
}

/* ─────────────── dashboard quick actions ─────────────── */

const ACTIONS = [
  ['content', 'Add tutorial video', Video, 'content:manage'], ['content', 'Add FAQ', HelpCircle, 'content:manage'],
  ['announcements', 'Create announcement', Megaphone, 'announcements:manage'], ['plans', 'Create / edit plan', Layers, 'plans:manage'],
  ['plans', 'Manage features', ToggleRight, 'plans:manage'], ['support', 'Support tickets', LifeBuoy, 'support:manage'],
  ['users', 'View users', Users, 'businesses:view'], ['payments', 'View payments', IndianRupee, 'payments:view'],
];

export function QuickActions({ perms, go }) {
  const list = ACTIONS.filter(([, , , p]) => perms.includes(p));
  if (!list.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {list.map(([tab, label, Icon]) => (
        <button key={label} type="button" onClick={() => go(tab)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:border-slate-400">
          <Icon size={16} className="shrink-0 text-slate-500" />{label}
        </button>
      ))}
    </div>
  );
}
