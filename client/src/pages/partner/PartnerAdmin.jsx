import { useCallback, useEffect, useState } from 'react';
import {
  LogOut, Search, IndianRupee, KeyRound, AlertTriangle, ArrowLeft, Ban, Check,
} from 'lucide-react';
import api, { getToken, setToken } from './partnerApi';

/*
  ADMIN PANEL — sirf aapke liye.

  Yahan se PAISA NAHI JATA. Aap khud UPI ya bank se bhejte hain aur yahan
  "de diya" mark kar dete hain. Payout ka koi rasta na hona hi is panel ki
  sabse badi suraksha hai: jo darwaza hai hi nahi, us se chori nahi hoti.
*/

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

function Login({ onDone }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/admin/login', f);
      setToken(res.data.token, true);
      onDone(res.data);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
          <KeyRound size={20} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Salesman ka hisaab</p>
      </div>

      <form onSubmit={go} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <input
          type="email" placeholder="Email" required value={f.email}
          onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
        />
        <input
          type="password" placeholder="Password" required value={f.password}
          onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-900"
        />
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Ruko...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

/** Ek salesman ka poora byora + "de diya" */
function One({ id, onBack }) {
  const [d, setD] = useState(null);
  const [amt, setAmt] = useState('');
  const [ref, setRef] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD((await api.get(`/admin/one/${id}`)).data); } catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function markPaid(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.post(`/admin/paid/${id}`, {
        amountRupees: Number(amt), reference: ref,
      });
      setD(res.data); setAmt(''); setRef('');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  if (!d) return <div className="py-20 text-center text-slate-400">{err || 'Ruko...'}</div>;
  const s = d.salesman;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
        <ArrowLeft size={15} /> Wapas
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-lg font-bold text-slate-900">{s.name}</p>
        <p className="text-sm text-slate-500">{s.phone} · code {s.refCode}</p>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-700">Paisa yahan bhejein</p>
          {s.payout?.mode === 'bank' ? (
            <p className="mt-1 text-slate-900">
              {s.payout.accountName}<br />
              A/c {s.payout.accountNumber}<br />
              IFSC {s.payout.ifsc}
            </p>
          ) : (
            <p className="mt-1 font-mono text-slate-900">{s.payout?.upiId}</p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-lg font-bold text-slate-900">{inr(s.kamaiRupees)}</p><p className="text-xs text-slate-500">kamaya</p></div>
          <div><p className="text-lg font-bold text-slate-900">{inr(s.diyaRupees)}</p><p className="text-xs text-slate-500">de diya</p></div>
          <div><p className="text-lg font-bold text-amber-700">{inr(s.baakiRupees)}</p><p className="text-xs text-slate-500">baaki</p></div>
        </div>
      </div>

      {s.baakiRupees > 0 && (
        <form onSubmit={markPaid} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 text-sm font-semibold text-emerald-900">
            Paisa bhejne ke BAAD yahan mark karein
          </p>
          <div className="flex gap-2">
            <input
              type="number" step="0.01" min="1" max={s.baakiRupees} required
              placeholder={`Zyada se zyada ${s.baakiRupees}`}
              value={amt} onChange={(e) => setAmt(e.target.value)}
              className="w-40 rounded-lg border border-emerald-300 px-3 py-2 outline-none"
            />
            <input
              placeholder="UTR / reference (marzi se)"
              value={ref} onChange={(e) => setRef(e.target.value)}
              className="flex-1 rounded-lg border border-emerald-300 px-3 py-2 outline-none"
            />
            <button
              type="submit" disabled={busy}
              className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              De diya
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <p className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold">Jodi hui dukaanein ({d.dukaanein.length})</p>
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {d.dukaanein.map((r, i) => (
            <div key={i} className="flex justify-between px-4 py-2 text-sm">
              <span className="text-slate-700">{r.shopName || '(naam nahi)'} · {dt(r.juda)}</span>
              <span className="font-medium">{r.mahine} mah · {inr(r.kamaiRupees)}</span>
            </div>
          ))}
        </div>
      </div>

      {d.diyaGaya.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <p className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold">Kab kitna diya</p>
          <div className="divide-y divide-slate-100">
            {d.diyaGaya.map((p, i) => (
              <div key={i} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-slate-600">{dt(p.kab)} {p.reference}</span>
                <span className="font-medium">{inr(p.rupees)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ onLogout, warnPassword }) {
  const [d, setD] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [pw, setPw] = useState(null);

  const load = useCallback(async () => {
    try { setD((await api.get(`/admin/list?q=${encodeURIComponent(q)}`)).data); } catch { /* dikh jayega */ }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <p className="font-bold text-slate-900">Salesman ka hisaab</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPw({})} className="rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100">
              <KeyRound size={15} />
            </button>
            <button type="button" onClick={onLogout} className="rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {warnPassword && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Aap abhi bhi wahi password use kar rahe hain jo setting me likha tha.
              Ye panel me sabka paisa dikhata hai — <button type="button" onClick={() => setPw({})} className="font-semibold underline">abhi badal lijiye</button>.
            </span>
          </div>
        )}

        {pw && <PasswordBox onClose={() => setPw(null)} />}

        {open ? <One id={open} onBack={() => { setOpen(null); load(); }} /> : (
          <>
            {d && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Salesman', d.jod.log],
                  ['Kul kamai', inr(d.jod.kulKamai)],
                  ['De diya', inr(d.jod.kulDiya)],
                  ['Dena baaki', inr(d.jod.kulBaaki)],
                ].map(([l, v], i) => (
                  <div key={l} className={`rounded-xl border p-3 ${i === 3 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                    <p className={`text-lg font-bold ${i === 3 ? 'text-amber-800' : 'text-slate-900'}`}>{v}</p>
                    <p className="text-xs text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                placeholder="Naam, number ya code se dhundhein"
                value={q} onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 outline-none focus:border-slate-900"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              {!d ? <p className="py-12 text-center text-slate-400">Ruko...</p>
                : d.salesmen.length === 0 ? <p className="py-12 text-center text-slate-500">Koi salesman nahi mila</p>
                  : (
                    <div className="divide-y divide-slate-100">
                      {d.salesmen.map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          onClick={() => setOpen(s._id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                              {s.name}
                              {!s.active && <Ban size={12} className="text-red-500" />}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.phone} · {s.joinedCount} dukaan · code {s.refCode}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-bold ${s.baakiRupees > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                              {inr(s.baakiRupees)}
                            </p>
                            <p className="text-[11px] text-slate-400">kamaya {inr(s.kamaiRupees)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PasswordBox({ onClose }) {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function go(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await api.post('/admin/password', f);
      setMsg('Password badal gaya. Ab purana password nahi chalega.');
      setF({ currentPassword: '', newPassword: '' });
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <form onSubmit={go} className="rounded-xl border border-slate-300 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Password badlein</p>
        <button type="button" onClick={onClose} className="text-sm text-slate-500">Band karein</button>
      </div>
      <div className="flex gap-2">
        <input
          type="password" placeholder="Purana password" required value={f.currentPassword}
          onChange={(e) => setF((p) => ({ ...p, currentPassword: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none"
        />
        <input
          type="password" placeholder="Naya (8+ akshar)" required value={f.newPassword}
          onChange={(e) => setF((p) => ({ ...p, newPassword: e.target.value }))}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Badlein</button>
      </div>
      {msg && <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700"><Check size={14} />{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
    </form>
  );
}

export default function PartnerAdmin() {
  const [logged, setLogged] = useState(() => Boolean(getToken(true)));
  const [warn, setWarn] = useState(false);

  const logout = () => { setToken('', true); setLogged(false); };

  return logged
    ? <Panel onLogout={logout} warnPassword={warn} />
    : <Login onDone={(d) => { setWarn(!d.passwordChanged); setLogged(true); }} />;
}
