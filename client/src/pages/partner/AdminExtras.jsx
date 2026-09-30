import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, ShieldCheck, Lock, Paperclip, ArrowUp, ArrowDown, Eye, Star, Trash2,
} from 'lucide-react';
import api from './partnerApi';

const P = '/admin/platform';
const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';
const dtt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const Card = ({ children, className = '' }) => <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>;
const Err = ({ msg }) => (msg ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p> : null);
function Btn({ children, onClick, tone = 'dark', type = 'button', disabled, small }) {
  const cls = { dark: 'bg-slate-900 text-white hover:bg-slate-800', light: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50', red: 'bg-red-600 text-white' }[tone];
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-50 ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm'} ${cls}`}>{children}</button>;
}
function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { try { setErr(''); setData(await fn()); } catch (e) { setErr(e.message); } }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, err, load };
}
const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{children}</button>
);

/* ═══════════════════════════════ ADMINS ═══════════════════════════════ */

export function AdminAdmins({ meId }) {
  const { data, err, load } = useLoad(async () => (await api.get('/admin/admins')).data, []);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [e2, setE2] = useState('');

  async function save(e) {
    e.preventDefault(); setE2('');
    try {
      if (form._id) await api.put(`/admin/admins/${form._id}`, { name: form.name, role: form.role, require2fa: form.require2fa, active: form.active });
      else await api.post('/admin/admins', form);
      setForm(null); setMsg('Saved'); load();
    } catch (x) { setE2(x.message); }
  }
  async function reset(a, what) {
    const password = what === 'password' ? window.prompt(`New temporary password for ${a.email} (10+ letters & numbers)`) : undefined;
    if (what === 'password' && !password) return;
    if (what === '2fa' && !window.confirm(`Remove two-step verification for ${a.email}? They will set it up again.`)) return;
    try { await api.post(`/admin/admins/${a._id}/reset`, what === 'password' ? { password } : { reset2fa: true }); setMsg(`${a.email} reset and signed out`); load(); } catch (x) { setE2(x.message); }
  }

  if (!data) return <><Err msg={err} /><p className="py-8 text-center text-slate-400">Loading…</p></>;
  const roles = data.roles;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><p className="font-semibold text-slate-900">Admins & roles</p><p className="text-sm text-slate-500">Give each person only the access they need.</p></div>
        <Btn onClick={() => setForm({ email: '', name: '', role: 'support', password: '', require2fa: true })}><Plus size={14} />Add admin</Btn>
      </div>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Err msg={e2} />
      {form && (
        <Card>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {!form._id && <input className={input} type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
            {!form._id && <input className={input} type="password" placeholder="Temporary password (10+ letters & numbers)" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.require2fa} onChange={(e) => setForm({ ...form, require2fa: e.target.checked })} />Require two-step verification</label>
            {form._id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Account active</label>}
            <p className="text-xs text-slate-500 sm:col-span-2">Access: {roles.find((r) => r.value === form.role)?.perms.map((p) => data.perms[p]).join(' · ')}</p>
            <div className="flex gap-2 sm:col-span-2"><Btn type="submit">Save</Btn><Btn tone="light" onClick={() => setForm(null)}>Cancel</Btn></div>
          </form>
        </Card>
      )}
      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {data.admins.map((a) => (
            <div key={a._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{a.name || a.email} {!a.active && <span className="ml-1 rounded bg-red-100 px-1.5 text-xs text-red-700">Disabled</span>} {String(a._id) === String(meId) && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p>
                <p className="text-xs text-slate-500">{a.email} · {a.roleLabel} · {a.totpEnabled ? <span className="text-emerald-700"><ShieldCheck size={11} className="inline" /> 2FA on</span> : a.require2fa ? <span className="text-amber-700">2FA required, not set</span> : '2FA off'} · last sign-in {dtt(a.lastLoginAt)}</p>
              </div>
              {String(a._id) !== String(meId) && (
                <div className="flex flex-wrap gap-1.5">
                  <Btn small tone="light" onClick={() => setForm({ ...a })}>Edit</Btn>
                  <Btn small tone="light" onClick={() => reset(a, 'password')}>Reset password</Btn>
                  {a.totpEnabled && <Btn small tone="light" onClick={() => reset(a, '2fa')}>Reset 2FA</Btn>}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ SUPPORT ═══════════════════════════════ */

const ST = { open: ['Open', 'bg-sky-100 text-sky-800'], in_progress: ['In progress', 'bg-indigo-100 text-indigo-800'], waiting_user: ['Waiting for user', 'bg-amber-100 text-amber-800'], resolved: ['Resolved', 'bg-emerald-100 text-emerald-800'], closed: ['Closed', 'bg-slate-200 text-slate-700'] };
const PR = { low: 'text-slate-500', normal: 'text-slate-700', high: 'text-orange-600 font-semibold', urgent: 'text-red-600 font-bold' };
const Status = ({ s }) => <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ST[s]?.[1]}`}>{ST[s]?.[0] || s}</span>;

function Ticket({ id, onBack }) {
  const [t, setT] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { try { setT((await api.get(`${P}/support/${id}`)).data); } catch (e) { setErr(e.message); } }, [id]);
  useEffect(() => { load(); api.get(`${P}/support/admins`).then((r) => setAdmins(r.data)).catch(() => {}); }, [load]);

  async function reply(e) {
    e.preventDefault(); setErr('');
    try { setT((await api.post(`${P}/support/${id}/reply`, { text, internal })).data); setText(''); setInternal(false); } catch (x) { setErr(x.message); }
  }
  async function update(patch) {
    try { setT((await api.put(`${P}/support/${id}`, patch)).data); } catch (x) { setErr(x.message); }
  }
  if (!t) return <><Err msg={err} /><p className="py-8 text-center text-slate-400">Loading…</p></>;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft size={14} />All tickets</button>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{t.ticketNo} · {t.category.replace('_', ' ')} · {t.userType}</p>
            <p className="text-lg font-semibold text-slate-900">{t.subject}</p>
            <p className="text-sm text-slate-500">{t.user?.name} · {t.user?.phone}{t.business ? ` · ${t.business.name}` : ''} · opened {dtt(t.createdAt)}</p>
          </div>
          <Status s={t.status} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select className={input} value={t.status} onChange={(e) => update({ status: e.target.value })}>{Object.entries(ST).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className={input} value={t.priority} onChange={(e) => update({ priority: e.target.value })}>{Object.keys(PR).map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)} priority</option>)}</select>
          <select className={input} value={t.assignedAdminId || ''} onChange={(e) => update({ assignedAdminId: e.target.value || null })}>
            <option value="">Unassigned</option>{admins.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
      </Card>
      <Err msg={err} />
      <div className="space-y-2">
        {t.messages.map((m) => (
          <div key={m._id} className={`rounded-xl border p-3 ${m.internal ? 'border-amber-200 bg-amber-50' : m.by === 'admin' ? 'ml-8 border-slate-200 bg-slate-50' : 'mr-8 border-slate-200 bg-white'}`}>
            <p className="text-xs text-slate-500">{m.internal && <Lock size={11} className="mr-1 inline" />}{m.byName} · {dtt(m.at)}{m.internal ? ' · internal note' : ''}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-900">{m.text}</p>
            {m.attachments?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">{m.attachments.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Attachment" className="h-20 w-20 rounded-lg object-cover" /></a>)}</div>
            )}
          </div>
        ))}
      </div>
      {t.status !== 'closed' && (
        <Card>
          <form onSubmit={reply} className="space-y-2">
            <textarea rows={3} className={`${input} w-full`} placeholder={internal ? 'Internal note — the user will not see this' : 'Reply to the user'} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal note</label>
              <Btn type="submit" disabled={!text.trim()}>{internal ? 'Add note' : 'Send reply'}</Btn>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function AdminSupport() {
  const [status, setStatus] = useState('active');
  const [assigned, setAssigned] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const { data, err, load } = useLoad(async () => (await api.get(`${P}/support`, { params: { status, assigned, q } })).data, [status, assigned, q]);
  if (open) return <Ticket id={open} onBack={() => { setOpen(null); load(); }} />;
  const c = data?.counts || {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[['active', `Active (${c.active || 0})`], ['open', 'Open'], ['waiting_user', 'Waiting for user'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['', 'All']].map(([v, l]) => <Chip key={v} on={status === v} onClick={() => setStatus(v)}>{l}</Chip>)}
        <span className="mx-1 h-4 w-px bg-slate-300" />
        {[['', 'Anyone'], ['me', 'Assigned to me'], ['none', 'Unassigned']].map(([v, l]) => <Chip key={v} on={assigned === v} onClick={() => setAssigned(v)}>{l}</Chip>)}
        <input className={`${input} ml-auto w-48`} placeholder="Ticket no. or subject" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {c.urgent > 0 && <p className="text-sm font-medium text-red-700">{c.urgent} high-priority ticket(s) need attention</p>}
      <Err msg={err} />
      <Card className="p-0">
        {!data ? <p className="py-8 text-center text-slate-400">Loading…</p> : !data.rows.length ? <p className="py-10 text-center text-slate-500">No tickets here</p> : (
          <div className="divide-y divide-slate-100">
            {data.rows.map((r) => (
              <button key={r._id} type="button" onClick={() => setOpen(r._id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                {r.adminUnread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{r.subject}</p>
                  <p className="truncate text-xs text-slate-500">{r.ticketNo} · {r.userName} · {r.businessName || r.userType} · <span className={PR[r.priority]}>{r.priority}</span>{r.assignedName ? ` · ${r.assignedName}` : ''}</p>
                </div>
                <div className="shrink-0 text-right"><Status s={r.status} /><p className="mt-1 text-[11px] text-slate-400">{dtt(r.lastActivityAt)}</p></div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ CONTENT ═══════════════════════════════ */

const KINDS = [['video', 'Videos'], ['article', 'Help articles'], ['faq', 'FAQs']];
const blank = (kind) => ({
  kind, title: '', titleHi: '', description: '', body: '', bodyHi: '', thumbnailUrl: '', videos: { hi: '', en: '' },
  category: '', placements: [], userTypes: [], plans: [], platforms: [], status: 'draft', publishAt: null, featured: false, inOnboardingTour: false,
});
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function ContentForm({ item, options, plans, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...blank(item.kind), ...item, videos: { hi: '', en: '', ...(item.videos || {}) } }));
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  async function save(e) {
    e.preventDefault(); setErr('');
    const body = { ...f, publishAt: f.publishAt || null };
    ['_id', 'key', 'stats', 'order', 'createdAt', 'updatedAt', '__v'].forEach((k) => delete body[k]);
    try {
      if (item._id) await api.put(`${P}/content/${item._id}`, body);
      else await api.post(`${P}/content`, body);
      onSaved();
    } catch (x) { setErr(x.message); }
  }
  const isVideo = f.kind === 'video';
  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <p className="font-semibold text-slate-900">{item._id ? 'Edit' : 'New'} {f.kind === 'faq' ? 'FAQ' : f.kind === 'article' ? 'help article' : 'video'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} required placeholder={f.kind === 'faq' ? 'Question (English)' : 'Title (English)'} value={f.title} onChange={(e) => set('title', e.target.value)} />
          <input className={input} placeholder={f.kind === 'faq' ? 'Question (Hindi, optional)' : 'Title (Hindi, optional)'} value={f.titleHi} onChange={(e) => set('titleHi', e.target.value)} />
          {isVideo ? (
            <>
              <input className={input} placeholder="English video link (YouTube or .mp4)" value={f.videos.en} onChange={(e) => set('videos', { ...f.videos, en: e.target.value })} />
              <input className={input} placeholder="Hindi video link" value={f.videos.hi} onChange={(e) => set('videos', { ...f.videos, hi: e.target.value })} />
              <input className={input} placeholder="Thumbnail image link (optional)" value={f.thumbnailUrl} onChange={(e) => set('thumbnailUrl', e.target.value)} />
            </>
          ) : (
            <>
              <textarea rows={4} className={`${input} sm:col-span-1`} placeholder={f.kind === 'faq' ? 'Answer (English)' : 'Article text (English)'} value={f.body} onChange={(e) => set('body', e.target.value)} />
              <textarea rows={4} className={input} placeholder={f.kind === 'faq' ? 'Answer (Hindi, optional)' : 'Article text (Hindi, optional)'} value={f.bodyHi} onChange={(e) => set('bodyHi', e.target.value)} />
            </>
          )}
          <input className={input} placeholder="Short description (optional)" value={f.description} onChange={(e) => set('description', e.target.value)} />
          <select className={input} value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">Category</option>{options.categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value)}>{options.statuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
          <label className="text-xs text-slate-500">Publish on (optional)
            <input type="datetime-local" className={`${input} mt-1 w-full`} value={f.publishAt ? new Date(new Date(f.publishAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(e) => set('publishAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </label>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Show on</p>
          <div className="flex flex-wrap gap-1.5">{options.placements.map((p) => <Chip key={p.value} on={f.placements.includes(p.value)} onClick={() => set('placements', toggle(f.placements, p.value))}>{p.label}</Chip>)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">User type <span className="font-normal normal-case">(none = everyone)</span></p>
            <div className="flex flex-wrap gap-1.5">{options.userTypes.map((u) => <Chip key={u} on={f.userTypes.includes(u)} onClick={() => set('userTypes', toggle(f.userTypes, u))}>{u === 'buyer' ? 'Buyer/Retailer' : u[0].toUpperCase() + u.slice(1)}</Chip>)}</div></div>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan <span className="font-normal normal-case">(none = all)</span></p>
            <div className="flex flex-wrap gap-1.5">{plans.map((p) => <Chip key={p.code} on={f.plans.includes(p.code)} onClick={() => set('plans', toggle(f.plans, p.code))}>{p.name}</Chip>)}</div></div>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Device <span className="font-normal normal-case">(none = all)</span></p>
            <div className="flex flex-wrap gap-1.5">{options.platforms.map((p) => <Chip key={p} on={f.platforms.includes(p)} onClick={() => set('platforms', toggle(f.platforms, p))}>{{ android: 'Android', web: 'Web', desktop: 'PC / Desktop' }[p]}</Chip>)}</div></div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} />Featured (shown first)</label>
          {isVideo && <label className="flex items-center gap-2"><input type="checkbox" checked={f.inOnboardingTour} onChange={(e) => set('inOnboardingTour', e.target.checked)} />Part of the first-time tour</label>}
        </div>
        <Err msg={err} />
        <div className="flex gap-2"><Btn type="submit">Save</Btn><Btn tone="light" onClick={onClose}>Cancel</Btn></div>
      </form>
    </Card>
  );
}

export function AdminContent({ plans = [] }) {
  const [kind, setKind] = useState('video');
  const [edit, setEdit] = useState(null);
  const [stats, setStats] = useState(null);
  const { data, err, load } = useLoad(async () => (await api.get(`${P}/content`, { params: { kind } })).data, [kind]);
  async function move(i, d) {
    const ids = data.rows.map((r) => r._id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    try { await api.put(`${P}/content/order`, { ids }); load(); } catch { /* shown on reload */ }
  }
  async function remove(r) {
    if (!window.confirm(`Delete "${r.title}"? Its view history is deleted too. To hide it instead, set it to Unpublished.`)) return;
    try { await api.delete(`${P}/content/${r._id}`); load(); } catch { /* shown on reload */ }
  }
  if (edit) return <ContentForm item={edit} options={data.options} plans={plans} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />;
  const placementLabel = (v) => data?.options.placements.find((p) => p.value === v)?.label || v;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map(([v, l]) => <Chip key={v} on={kind === v} onClick={() => setKind(v)}>{l}</Chip>)}
        <span className="ml-auto" />
        {data && <Btn onClick={() => setEdit(blank(kind))}><Plus size={14} />New</Btn>}
      </div>
      <p className="text-sm text-slate-500">Choose where each item appears, for whom and on which device — no code changes needed. If the chosen language is missing, the other language is shown.</p>
      <Err msg={err} />
      <Card className="p-0">
        {!data ? <p className="py-8 text-center text-slate-400">Loading…</p> : !data.rows.length ? <p className="py-10 text-center text-slate-500">Nothing yet</p> : (
          <div className="divide-y divide-slate-100">
            {data.rows.map((r, i) => (
              <div key={r._id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="text-slate-400 disabled:opacity-20"><ArrowUp size={14} /></button>
                    <button type="button" disabled={i === data.rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="text-slate-400 disabled:opacity-20"><ArrowDown size={14} /></button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{r.featured && <Star size={12} className="mr-1 inline text-amber-500" />}{r.title}
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${r.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span></p>
                    <p className="truncate text-xs text-slate-500">
                      {r.placements.length ? r.placements.map(placementLabel).join(', ') : 'Not placed on any page'}
                      {r.kind === 'video' && ` · ${['en', 'hi'].filter((l) => r.videos?.[l]).map((l) => l.toUpperCase()).join(' + ') || 'no link'}`}
                      {r.userTypes.length ? ` · ${r.userTypes.join('/')}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setStats(stats === r._id ? null : r._id)} className="inline-flex items-center gap-1 text-xs text-slate-600"><Eye size={13} />{r.stats.views} views</button>
                  <Btn small tone="light" onClick={() => setEdit(r)}>Edit</Btn>
                  <button type="button" onClick={() => remove(r)} aria-label="Delete" className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
                {stats === r._id && (
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
                    <span>Unique viewers: <b>{r.stats.uniqueViewers}</b></span>
                    <span>Completed: <b>{r.stats.completionRate}%</b></span>
                    <span>Avg. watch: <b>{r.stats.avgSeconds}s</b></span>
                    <span>Last viewed: <b>{dtt(r.stats.lastViewedAt)}</b></span>
                    <span>By language: <b>{Object.entries(r.stats.byLang).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ') || '—'}</b></span>
                    <span>By device: <b>{Object.entries(r.stats.byPlatform).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}</b></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-400"><Paperclip size={11} className="inline" /> Tip: upload videos to YouTube (unlisted is fine) and paste the link — it plays inside the app.</p>
    </div>
  );
}
